import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, createAuthResponse, AuthError } from "@/lib/auth-helpers";

export interface TourStateResponse {
  step1CompletedAt: string | null;
  step2CompletedAt: string | null;
  step3CompletedAt: string | null;
  /** Step 4 (upload-story showcase) fires when step1 is done AND step4 is not, on every visit
   *  to /stories. Independent of nextStep; it doesn't gate the sequential 1→2→3 flow. */
  step4CompletedAt: string | null;
  tourCompletedAt: string | null;
  /** Next sequential step the user must do to progress 1→2→3. Step 4 fires by its own rule
   *  and is NOT included here. */
  nextStep: 1 | 2 | 3 | null;
}

function buildResponse(user: {
  tourStep1CompletedAt: Date | null;
  tourStep2CompletedAt: Date | null;
  tourStep3CompletedAt: Date | null;
  tourStep4CompletedAt: Date | null;
  tourCompletedAt: Date | null;
}): TourStateResponse {
  let nextStep: 1 | 2 | 3 | null = null;
  if (!user.tourStep1CompletedAt) nextStep = 1;
  else if (!user.tourStep2CompletedAt) nextStep = 2;
  else if (!user.tourStep3CompletedAt) nextStep = 3;

  return {
    step1CompletedAt: user.tourStep1CompletedAt?.toISOString() ?? null,
    step2CompletedAt: user.tourStep2CompletedAt?.toISOString() ?? null,
    step3CompletedAt: user.tourStep3CompletedAt?.toISOString() ?? null,
    step4CompletedAt: user.tourStep4CompletedAt?.toISOString() ?? null,
    tourCompletedAt: user.tourCompletedAt?.toISOString() ?? null,
    nextStep,
  };
}

export async function GET() {
  try {
    const authenticatedUser = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      select: {
        tourStep1CompletedAt: true,
        tourStep2CompletedAt: true,
        tourStep3CompletedAt: true,
        tourStep4CompletedAt: true,
        tourCompletedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(buildResponse(user));
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthResponse(error);
    }
    console.error("Tour state fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tour state" },
      { status: 500 }
    );
  }
}
