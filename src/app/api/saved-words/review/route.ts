// src/app/api/saved-words/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { calculateSM2 } from '@/lib/sm2';

// POST: Submit a review result and update SM-2 data
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { savedWordId, quality, direction } = body;

    // Validate input
    if (!savedWordId) {
      return NextResponse.json(
        { error: 'Missing savedWordId' },
        { status: 400 }
      );
    }

    if (quality === undefined || quality < 1 || quality > 4) {
      return NextResponse.json(
        { error: 'Quality must be between 1 and 4' },
        { status: 400 }
      );
    }

    if (!direction || !['es-en', 'en-es'].includes(direction)) {
      return NextResponse.json(
        { error: 'Direction must be "es-en" or "en-es"' },
        { status: 400 }
      );
    }

    // Get the saved word and verify ownership
    const savedWord = await prisma.savedWord.findFirst({
      where: {
        id: savedWordId,
        userId: session.user.id,
      },
    });

    if (!savedWord) {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      );
    }

    // Calculate new FSRS values
    const sm2Result = calculateSM2({
      quality,
      repetitions: savedWord.repetitions,
      easeFactor: savedWord.easeFactor,
      interval: savedWord.interval,
      stability: savedWord.stability,
    });

    // Update the saved word and create review log in a transaction
    const [updatedWord, reviewLog] = await prisma.$transaction([
      prisma.savedWord.update({
        where: { id: savedWordId },
        data: {
          repetitions: sm2Result.repetitions,
          easeFactor: sm2Result.easeFactor,
          interval: sm2Result.interval,
          nextReviewDate: sm2Result.nextReviewDate,
          stability: sm2Result.stability,
        },
      }),
      prisma.reviewLog.create({
        data: {
          savedWordId,
          userId: session.user.id,
          quality,
          direction,
          prevInterval: savedWord.interval,
          prevEaseFactor: savedWord.easeFactor,
          newInterval: sm2Result.interval,
          newEaseFactor: sm2Result.easeFactor,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      updatedWord: {
        id: updatedWord.id,
        repetitions: updatedWord.repetitions,
        easeFactor: updatedWord.easeFactor,
        interval: updatedWord.interval,
        nextReviewDate: updatedWord.nextReviewDate,
      },
      reviewLog: {
        id: reviewLog.id,
      },
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}
