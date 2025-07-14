// src/app/api/report-feedback/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const data = await req.json();

  await resend.emails.send({
    from: "onboarding@resend.dev", // or your verified sender later
    to: "philipwooleryprice@gmail.com",
    subject: `📝 New Feedback: ${data.type || "Unspecified"}`,
    html: `
      <h2>New Feedback Submitted</h2>
      <p><strong>Type:</strong> ${data.type}</p>
      <p><strong>Mood:</strong> ${data.mood}</p>
      <p><strong>Message:</strong> ${data.message}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Page:</strong> ${data.pathname}</p>
      <p><strong>User Agent:</strong> ${data.userAgent}</p>
    `,
  });

  return NextResponse.json({ success: true });
}
