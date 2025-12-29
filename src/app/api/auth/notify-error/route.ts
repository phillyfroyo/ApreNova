// src/app/api/auth/notify-error/route.ts
// Notify admin when OAuth errors occur

import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cuentana.org';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { error, timestamp } = body;

    // Don't send if no API key configured
    if (!process.env.RESEND_API_KEY) {
      console.log('OAuth error (no email sent - RESEND_API_KEY not configured):', { error, timestamp });
      return NextResponse.json({ success: true, logged: true });
    }

    // Send notification email to admin
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[Cuentana] OAuth Error: ${error}`,
      html: `
        <h2>OAuth Authentication Error</h2>
        <p>A user encountered an OAuth error while trying to sign in.</p>
        <ul>
          <li><strong>Error Type:</strong> ${error}</li>
          <li><strong>Timestamp:</strong> ${timestamp}</li>
        </ul>
        <p>This typically indicates a configuration issue with Google OAuth.</p>
        <h3>Common Causes:</h3>
        <ul>
          <li>NEXTAUTH_SECRET mismatch between environments</li>
          <li>Google OAuth credentials not set in Vercel</li>
          <li>Redirect URI not properly configured in Google Console</li>
        </ul>
      `,
    });

    return NextResponse.json({ success: true, notified: true });
  } catch (err) {
    // Silent fail - don't expose errors to client
    console.error('Failed to send OAuth error notification:', err);
    return NextResponse.json({ success: true, logged: true });
  }
}
