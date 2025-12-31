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

  // Use native language for Stripe locale and currency selection
  const nativeLanguage = session.user.nativeLanguage || 'es';
  const stripeLocale = nativeLanguage === 'en' ? 'en' : 'es';

  // Select price based on native language (es = MXN, en = USD)
  // Falls back to MXN price if USD price not configured
  const priceId = nativeLanguage === 'en' && process.env.STRIPE_PRICE_ID_USD
    ? process.env.STRIPE_PRICE_ID_USD
    : process.env.STRIPE_PRICE_ID!;

  console.log("✅ Checkout for user:", session.user.id, "| Locale:", stripeLocale, "| Price:", priceId);

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/${lng || 'es'}/checkout/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/${lng || 'es'}/checkout/cancel`,
      client_reference_id: session.user.id,
      locale: stripeLocale,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("❌ Stripe Checkout Session Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
