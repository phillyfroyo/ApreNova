// src/app/api/saved-words/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

// GET: Retrieve saved words for the user
// Query params:
//   - due=true: Only return words due for review
//   - limit: Number of words to return (default 50)
//   - offset: Pagination offset
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dueOnly = searchParams.get('due') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where = {
      userId: session.user.id,
      ...(dueOnly && {
        nextReviewDate: { lte: new Date() },
      }),
    };

    const [words, total] = await Promise.all([
      prisma.savedWord.findMany({
        where,
        orderBy: dueOnly
          ? { nextReviewDate: 'asc' }
          : { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          word: true,
          translation: true,
          sourceSentence: true,
          storySlug: true,
          easeFactor: true,
          interval: true,
          repetitions: true,
          nextReviewDate: true,
          createdAt: true,
        },
      }),
      prisma.savedWord.count({ where }),
    ]);

    return NextResponse.json({
      words,
      total,
      hasMore: offset + words.length < total,
    });
  } catch (error) {
    console.error('Error retrieving saved words:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved words' },
      { status: 500 }
    );
  }
}

// POST: Save a new word or phrase
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { word, translation, sourceSentence, storySlug } = body;

    if (!word || !translation) {
      return NextResponse.json(
        { error: 'Missing required fields: word and translation' },
        { status: 400 }
      );
    }

    // Normalize the word (trim, lowercase for comparison)
    const normalizedWord = word.trim();

    // Check if word already exists for this user
    const existing = await prisma.savedWord.findUnique({
      where: {
        userId_word: {
          userId: session.user.id,
          word: normalizedWord,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Word already saved', code: 'WORD_EXISTS', existing },
        { status: 409 }
      );
    }

    // Create new saved word with SM-2 defaults
    const savedWord = await prisma.savedWord.create({
      data: {
        userId: session.user.id,
        word: normalizedWord,
        translation: translation.trim(),
        sourceSentence: sourceSentence?.trim() || null,
        storySlug: storySlug || null,
        // SM-2 defaults are set in schema
      },
    });

    return NextResponse.json({ success: true, savedWord });
  } catch (error) {
    console.error('Error saving word:', error);
    return NextResponse.json(
      { error: 'Failed to save word' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a saved word
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing word ID' },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const word = await prisma.savedWord.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!word) {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      );
    }

    await prisma.savedWord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting word:', error);
    return NextResponse.json(
      { error: 'Failed to delete word' },
      { status: 500 }
    );
  }
}
