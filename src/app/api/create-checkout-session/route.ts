// src/app/api/create-checkout-session/route.ts

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    console.error("❌ No user ID found in session.");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lng } = await req.json();

  // ✅ Add this line right after the session check:
  console.log("✅ Logged-in user ID at checkout:", session.user.id);

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
      client_reference_id: session.user.id,
      locale: ["es", "en"].includes(lng) ? lng : "auto"
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("❌ Stripe Checkout Session Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
