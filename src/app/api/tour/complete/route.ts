import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, createAuthResponse, AuthError } from "@/lib/auth-helpers";
import type { TourStateResponse } from "../state/route";

export async function POST(req: Request) {
  try {
    const authenticatedUser = await requireAuth();
    const body = await req.json();
    const step = body?.step;

    if (step !== 1 && step !== 2 && step !== 3 && step !== 4) {
      return NextResponse.json(
        { error: "Invalid step. Must be 1, 2, 3, or 4." },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUnique({
      where: { id: authenticatedUser.id },
      select: {
        tourStep1CompletedAt: true,
        tourStep2CompletedAt: true,
        tourStep3CompletedAt: true,
        tourStep4CompletedAt: true,
        tourCompletedAt: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const data: Record<string, Date> = {};

    if (step === 1 && !current.tourStep1CompletedAt) data.tourStep1CompletedAt = now;
    if (step === 2 && !current.tourStep2CompletedAt) data.tourStep2CompletedAt = now;
    if (step === 3 && !current.tourStep3CompletedAt) data.tourStep3CompletedAt = now;
    if (step === 4 && !current.tourStep4CompletedAt) data.tourStep4CompletedAt = now;

    // tourCompletedAt fires when the sequential 1→2→3 path is done.
    // Step 4 is independent and doesn't gate completion.
    const willHaveStep1 = current.tourStep1CompletedAt || data.tourStep1CompletedAt;
    const willHaveStep2 = current.tourStep2CompletedAt || data.tourStep2CompletedAt;
    const willHaveStep3 = current.tourStep3CompletedAt || data.tourStep3CompletedAt;

    if (
      willHaveStep1 &&
      willHaveStep2 &&
      willHaveStep3 &&
      !current.tourCompletedAt
    ) {
      data.tourCompletedAt = now;
    }

    if (Object.keys(data).length === 0) {
      const response: TourStateResponse = {
        step1CompletedAt: current.tourStep1CompletedAt?.toISOString() ?? null,
        step2CompletedAt: current.tourStep2CompletedAt?.toISOString() ?? null,
        step3CompletedAt: current.tourStep3CompletedAt?.toISOString() ?? null,
        step4CompletedAt: current.tourStep4CompletedAt?.toISOString() ?? null,
        tourCompletedAt: current.tourCompletedAt?.toISOString() ?? null,
        nextStep: null,
      };
      const recompute = (r: TourStateResponse): TourStateResponse => {
        let nextStep: 1 | 2 | 3 | null = null;
        if (!r.step1CompletedAt) nextStep = 1;
        else if (!r.step2CompletedAt) nextStep = 2;
        else if (!r.step3CompletedAt) nextStep = 3;
        return { ...r, nextStep };
      };
      return NextResponse.json(recompute(response));
    }

    const updated = await prisma.user.update({
      where: { id: authenticatedUser.id },
      data,
      select: {
        tourStep1CompletedAt: true,
        tourStep2CompletedAt: true,
        tourStep3CompletedAt: true,
        tourStep4CompletedAt: true,
        tourCompletedAt: true,
      },
    });

    let nextStep: 1 | 2 | 3 | null = null;
    if (!updated.tourStep1CompletedAt) nextStep = 1;
    else if (!updated.tourStep2CompletedAt) nextStep = 2;
    else if (!updated.tourStep3CompletedAt) nextStep = 3;

    const response: TourStateResponse = {
      step1CompletedAt: updated.tourStep1CompletedAt?.toISOString() ?? null,
      step2CompletedAt: updated.tourStep2CompletedAt?.toISOString() ?? null,
      step3CompletedAt: updated.tourStep3CompletedAt?.toISOString() ?? null,
      step4CompletedAt: updated.tourStep4CompletedAt?.toISOString() ?? null,
      tourCompletedAt: updated.tourCompletedAt?.toISOString() ?? null,
      nextStep,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return createAuthResponse(error);
    }
    console.error("Tour complete error:", error);
    return NextResponse.json(
      { error: "Failed to mark tour step complete" },
      { status: 500 }
    );
  }
}
