// src/app/api/user/delete-account/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Get user to check for Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If user has a Stripe subscription, cancel it
    if (user.stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
        });
        for (const subscription of subscriptions.data) {
          await stripe.subscriptions.cancel(subscription.id);
        }
      } catch (stripeError) {
        console.error('Error canceling Stripe subscription:', stripeError);
      }
    }

    // Delete user content but preserve cost data
    await Promise.all([
      prisma.sessionLog.deleteMany({ where: { userId } }),
      prisma.pageVisit.deleteMany({ where: { userId } }),
      prisma.completedStory.deleteMany({ where: { userId } }),
      prisma.storyBookmark.deleteMany({ where: { userId } }),
      prisma.userStoryBookmark.deleteMany({ where: { userId } }),
      prisma.storyTutorMessage.deleteMany({ where: { userId } }),
      prisma.tutorMessage.deleteMany({ where: { userId } }),
      prisma.reviewLog.deleteMany({ where: { userId } }),
      prisma.savedWord.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    // Delete user stories (ApiCost.userStoryId will be set to null via SetNull)
    await prisma.userStory.deleteMany({ where: { userId } });

    // Soft-delete: mark as deleted, clear sensitive data, free up email for re-registration
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted_${userId}@deleted.local`,
        password: null,
        image: null,
        stripeCustomerId: null,
        isPremium: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
