// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma"; // adjust if needed

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text(); // Stripe requires raw body
  const signature = req.headers.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log("📦 FULL SESSION OBJECT:", session);
    const userId = session.client_reference_id;

    if (!userId) {
      console.warn("⚠️ No client_reference_id found in session");
      return new NextResponse("Missing user ID", { status: 400 });
    }

    try {
      const result = await prisma.user.update({
        where: { id: userId },
        data: { isPremium: true },
      });

      console.log(`✅ User ${userId} upgraded to Premium`, result);
    } catch (err) {
      console.error("❌ Failed to update user:", err);
      return new NextResponse("DB error", { status: 500 });
    }
  }

  return new NextResponse("Webhook received", { status: 200 });
}
