// src/lib/admin/auth-service.ts
// Enhanced admin authentication with session tokens and rate limiting

import { validateAdminSecret } from "@/lib/auth-helpers";
import crypto from "crypto";

// ============================================================================
// Configuration
// ============================================================================

/** Session token lifetime in milliseconds (1 hour) */
const SESSION_LIFETIME_MS = 60 * 60 * 1000;

/** Rate limiting window in milliseconds (15 minutes) */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/** Maximum failed attempts before lockout */
const MAX_FAILED_ATTEMPTS = 5;

/** Base delay for exponential backoff in milliseconds */
const BASE_BACKOFF_MS = 1000;

/** Maximum backoff delay in milliseconds (5 minutes) */
const MAX_BACKOFF_MS = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface AdminSession {
  /** Unique session token */
  token: string;
  /** When the session was created */
  createdAt: number;
  /** When the session expires */
  expiresAt: number;
  /** Client identifier (IP or user agent hash) */
  clientId: string;
  /** Number of times token has been rotated */
  rotationCount: number;
}

export interface RateLimitEntry {
  /** Number of failed attempts in current window */
  failedAttempts: number;
  /** When the current window started */
  windowStart: number;
  /** When the client can retry (if locked out) */
  lockedUntil: number | null;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
  retryAfter?: number; // Seconds until retry is allowed
}

export interface ValidationResult {
  valid: boolean;
  session?: AdminSession;
  newToken?: string; // Rotated token if rotation occurred
  error?: string;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

// In production, these should be stored in Redis or another persistent store
const activeSessions = new Map<string, AdminSession>();
const rateLimitStore = new Map<string, RateLimitEntry>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a cryptographically secure token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a client identifier from request info
 */
export function getClientId(
  ip: string | null,
  userAgent: string | null
): string {
  const data = `${ip || "unknown"}-${userAgent || "unknown"}`;
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(failedAttempts: number): number {
  const delay = BASE_BACKOFF_MS * Math.pow(2, failedAttempts - 1);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt < now) {
      activeSessions.delete(token);
    }
  }
}

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [clientId, entry] of rateLimitStore.entries()) {
    // Remove entries outside the rate limit window with no active lockout
    if (
      now - entry.windowStart > RATE_LIMIT_WINDOW_MS &&
      (entry.lockedUntil === null || entry.lockedUntil < now)
    ) {
      rateLimitStore.delete(clientId);
    }
  }
}

// Run cleanup periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cleanupExpiredSessions();
    cleanupRateLimits();
  }, 5 * 60 * 1000);
}

// ============================================================================
// Rate Limiting Functions
// ============================================================================

/**
 * Check if a client is rate limited
 */
export function checkRateLimit(clientId: string): {
  allowed: boolean;
  retryAfter?: number;
  attemptsRemaining?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(clientId);

  if (!entry) {
    return { allowed: true, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  // Check if still in lockout period
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Check if window has expired (reset counter)
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.delete(clientId);
    return { allowed: true, attemptsRemaining: MAX_FAILED_ATTEMPTS };
  }

  // Check if max attempts reached
  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    // Calculate lockout duration with exponential backoff
    const lockoutDuration = calculateBackoff(entry.failedAttempts);
    entry.lockedUntil = now + lockoutDuration;
    rateLimitStore.set(clientId, entry);

    const retryAfter = Math.ceil(lockoutDuration / 1000);
    return { allowed: false, retryAfter };
  }

  return {
    allowed: true,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - entry.failedAttempts,
  };
}

/**
 * Record a failed authentication attempt
 */
export function recordFailedAttempt(clientId: string): {
  lockedOut: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  let entry = rateLimitStore.get(clientId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Start a new window
    entry = {
      failedAttempts: 1,
      windowStart: now,
      lockedUntil: null,
    };
  } else {
    entry.failedAttempts++;
  }

  // Check if we've hit the limit
  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutDuration = calculateBackoff(entry.failedAttempts);
    entry.lockedUntil = now + lockoutDuration;
    rateLimitStore.set(clientId, entry);

    return {
      lockedOut: true,
      retryAfter: Math.ceil(lockoutDuration / 1000),
    };
  }

  rateLimitStore.set(clientId, entry);
  return { lockedOut: false };
}

/**
 * Reset rate limit after successful authentication
 */
export function resetRateLimit(clientId: string): void {
  rateLimitStore.delete(clientId);
}

// ============================================================================
// Session Management Functions
// ============================================================================

/**
 * Authenticate with admin secret and create a session
 */
export function authenticate(
  secret: string,
  clientId: string
): AuthResult {
  // Check rate limiting
  const rateCheck = checkRateLimit(clientId);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed attempts. Try again in ${rateCheck.retryAfter} seconds.`,
      retryAfter: rateCheck.retryAfter,
    };
  }

  // Validate the secret
  const isValid = validateAdminSecret(secret);

  if (!isValid) {
    const { lockedOut, retryAfter } = recordFailedAttempt(clientId);

    if (lockedOut) {
      return {
        success: false,
        error: `Invalid secret. Account locked. Try again in ${retryAfter} seconds.`,
        retryAfter,
      };
    }

    const attemptsRemaining =
      MAX_FAILED_ATTEMPTS -
      (rateLimitStore.get(clientId)?.failedAttempts || 0);
    return {
      success: false,
      error: `Invalid admin secret. ${attemptsRemaining} attempts remaining.`,
    };
  }

  // Reset rate limit on success
  resetRateLimit(clientId);

  // Clean up any existing sessions for this client
  for (const [token, session] of activeSessions.entries()) {
    if (session.clientId === clientId) {
      activeSessions.delete(token);
    }
  }

  // Create a new session
  const now = Date.now();
  const token = generateToken();
  const session: AdminSession = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_LIFETIME_MS,
    clientId,
    rotationCount: 0,
  };

  activeSessions.set(token, session);

  console.log(`[AdminAuth] Created session for client ${clientId.slice(0, 8)}...`);

  return {
    success: true,
    token,
    expiresAt: session.expiresAt,
  };
}

/**
 * Validate a session token
 * Optionally rotate the token for enhanced security
 */
export function validateToken(
  token: string,
  clientId: string,
  rotate: boolean = false
): ValidationResult {
  const session = activeSessions.get(token);

  if (!session) {
    return { valid: false, error: "Invalid or expired session token" };
  }

  // Check if session has expired
  const now = Date.now();
  if (session.expiresAt < now) {
    activeSessions.delete(token);
    return { valid: false, error: "Session has expired" };
  }

  // Optional: Check client ID matches (helps prevent token theft)
  // Disabled by default as IP can change
  // if (session.clientId !== clientId) {
  //   return { valid: false, error: "Session client mismatch" };
  // }

  // Rotate token if requested
  if (rotate) {
    const newToken = generateToken();
    const newSession: AdminSession = {
      ...session,
      token: newToken,
      expiresAt: now + SESSION_LIFETIME_MS, // Extend expiration on rotation
      rotationCount: session.rotationCount + 1,
    };

    activeSessions.delete(token);
    activeSessions.set(newToken, newSession);

    console.log(
      `[AdminAuth] Rotated token for client ${clientId.slice(0, 8)}... (rotation #${newSession.rotationCount})`
    );

    return {
      valid: true,
      session: newSession,
      newToken,
    };
  }

  return { valid: true, session };
}

/**
 * Invalidate a session (logout)
 */
export function invalidateSession(token: string): boolean {
  const existed = activeSessions.has(token);
  activeSessions.delete(token);

  if (existed) {
    console.log("[AdminAuth] Session invalidated");
  }

  return existed;
}

/**
 * Invalidate all sessions for a client
 */
export function invalidateClientSessions(clientId: string): number {
  let count = 0;
  for (const [token, session] of activeSessions.entries()) {
    if (session.clientId === clientId) {
      activeSessions.delete(token);
      count++;
    }
  }

  if (count > 0) {
    console.log(`[AdminAuth] Invalidated ${count} sessions for client ${clientId.slice(0, 8)}...`);
  }

  return count;
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Get session info (for debugging/admin purposes)
 */
export function getSessionInfo(token: string): Partial<AdminSession> | null {
  const session = activeSessions.get(token);
  if (!session) return null;

  return {
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    rotationCount: session.rotationCount,
  };
}

/**
 * Get current stats (for monitoring)
 */
export function getAuthStats(): {
  activeSessions: number;
  rateLimitedClients: number;
} {
  cleanupExpiredSessions();
  cleanupRateLimits();

  const now = Date.now();
  let lockedClients = 0;
  for (const entry of rateLimitStore.values()) {
    if (entry.lockedUntil && entry.lockedUntil > now) {
      lockedClients++;
    }
  }

  return {
    activeSessions: activeSessions.size,
    rateLimitedClients: lockedClients,
  };
}

// ============================================================================
// Export Configuration Constants
// ============================================================================

export const AUTH_CONFIG = {
  SESSION_LIFETIME_MS,
  RATE_LIMIT_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
} as const;
