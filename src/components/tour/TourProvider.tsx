"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export type TourStep = 1 | 2 | 3 | 4;
/** Sequential steps that determine nextStep (1→2→3). Step 4 fires by its own rule
 *  (whenever step1 is done and step4 is not, on every /stories visit). */
export type SequentialTourStep = 1 | 2 | 3;

export interface TourState {
  step1CompletedAt: string | null;
  step2CompletedAt: string | null;
  step3CompletedAt: string | null;
  step4CompletedAt: string | null;
  tourCompletedAt: string | null;
  nextStep: SequentialTourStep | null;
}

interface TourContextValue {
  state: TourState | null;
  loading: boolean;
  /** True if the user prefers reduced motion or tour cannot run (unauthenticated, etc.). */
  disabled: boolean;
  markStepComplete: (step: TourStep) => Promise<void>;
}

const EMPTY_STATE: TourState = {
  step1CompletedAt: null,
  step2CompletedAt: null,
  step3CompletedAt: null,
  step4CompletedAt: null,
  tourCompletedAt: null,
  nextStep: 1,
};

const TourContext = createContext<TourContextValue | null>(null);

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const reducedMotion = usePrefersReducedMotion();
  const [state, setState] = useState<TourState | null>(null);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  const isAuthed = status === "authenticated";

  useEffect(() => {
    if (!isAuthed || fetched.current) return;
    fetched.current = true;
    setLoading(true);
    fetch("/api/tour/state", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TourState | null) => {
        if (data) setState(data);
      })
      .catch(() => {
        // Network failure: silently degrade. Tour just won't fire this session.
      })
      .finally(() => setLoading(false));
  }, [isAuthed]);

  const markStepComplete = useCallback(
    async (step: TourStep) => {
      if (!isAuthed) return;
      try {
        const res = await fetch("/api/tour/complete", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        });
        if (res.ok) {
          const data: TourState = await res.json();
          setState(data);
        }
      } catch {
        // Mark optimistically locally so the step doesn't re-fire this session.
        setState((prev) => {
          const base = prev ?? EMPTY_STATE;
          const now = new Date().toISOString();
          const updated: TourState = {
            ...base,
            step1CompletedAt: step === 1 ? base.step1CompletedAt ?? now : base.step1CompletedAt,
            step2CompletedAt: step === 2 ? base.step2CompletedAt ?? now : base.step2CompletedAt,
            step3CompletedAt: step === 3 ? base.step3CompletedAt ?? now : base.step3CompletedAt,
            step4CompletedAt: step === 4 ? base.step4CompletedAt ?? now : base.step4CompletedAt,
            nextStep: null,
          };
          if (!updated.step1CompletedAt) updated.nextStep = 1;
          else if (!updated.step2CompletedAt) updated.nextStep = 2;
          else if (!updated.step3CompletedAt) updated.nextStep = 3;
          else updated.nextStep = null;
          return updated;
        });
      }
    },
    [isAuthed]
  );

  const disabled = !isAuthed || reducedMotion;

  return (
    <TourContext.Provider value={{ state, loading, disabled, markStepComplete }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTourState(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    return {
      state: null,
      loading: false,
      disabled: true,
      markStepComplete: async () => {},
    };
  }
  return ctx;
}
