// src/lib/otp/index.ts
// OTP (One-Time Password) utilities for passwordless authentication

import { randomInt, createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

// Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;
const MAX_CODES_PER_EMAIL_PER_HOUR = 5;

/**
 * Generate a cryptographically secure random OTP code
 */
export function generateOtpCode(): string {
  // Generate random number between 0 and 999999, then pad with zeros
  const code = randomInt(0, Math.pow(10, OTP_LENGTH));
  return code.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Hash an OTP code for secure storage
 * Using SHA-256 is sufficient for short-lived OTPs
 */
export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Check if user has exceeded rate limit for OTP requests
 */
export async function checkOtpRateLimit(email: string): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMinutes?: number;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCodes = await prisma.otpCode.count({
    where: {
      email: email.toLowerCase(),
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCodes >= MAX_CODES_PER_EMAIL_PER_HOUR) {
    // Find the oldest code in the window to calculate retry time
    const oldestCode = await prisma.otpCode.findFirst({
      where: {
        email: email.toLowerCase(),
        createdAt: { gte: oneHourAgo },
      },
      orderBy: { createdAt: 'asc' },
    });

    const retryAfterMs = oldestCode
      ? oldestCode.createdAt.getTime() + 60 * 60 * 1000 - Date.now()
      : 60 * 60 * 1000;

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMinutes: Math.ceil(retryAfterMs / 60000),
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_CODES_PER_EMAIL_PER_HOUR - recentCodes - 1,
  };
}

/**
 * Create and store a new OTP code for an email
 */
export async function createOtpCode(email: string): Promise<{
  success: boolean;
  code?: string;
  error?: string;
}> {
  const normalizedEmail = email.toLowerCase();

  // Check rate limit
  const rateLimit = await checkOtpRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many code requests. Please try again in ${rateLimit.retryAfterMinutes} minutes.`,
    };
  }

  // Invalidate any existing unused codes for this email
  await prisma.otpCode.updateMany({
    where: {
      email: normalizedEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    data: { used: true },
  });

  // Generate new code
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Store in database
  await prisma.otpCode.create({
    data: {
      email: normalizedEmail,
      codeHash,
      expiresAt,
    },
  });

  return { success: true, code };
}

/**
 * Verify an OTP code
 */
export async function verifyOtpCode(email: string, code: string): Promise<{
  success: boolean;
  error?: string;
  errorCode?: string;
}> {
  const normalizedEmail = email.toLowerCase();
  const codeHash = hashOtpCode(code);

  // Find valid, unused code for this email
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      email: normalizedEmail,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    return {
      success: false,
      error: 'Code expired or not found. Please request a new code.',
      errorCode: 'CODE_EXPIRED',
    };
  }

  // Check if max attempts exceeded
  if (otpRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    // Invalidate the code
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    return {
      success: false,
      error: 'Too many incorrect attempts. Please request a new code.',
      errorCode: 'MAX_ATTEMPTS',
    };
  }

  // Verify the code
  if (otpRecord.codeHash !== codeHash) {
    // Increment attempts
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - otpRecord.attempts - 1;
    return {
      success: false,
      error: `Incorrect code. ${remainingAttempts} attempts remaining.`,
      errorCode: 'INVALID_CODE',
    };
  }

  // Code is valid - mark as used
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  return { success: true };
}

/**
 * Clean up expired OTP codes (run periodically)
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const result = await prisma.otpCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });

  return result.count;
}
