"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Map, Link2, ArrowRight, X, Sparkles } from "lucide-react";

// ═══════════════════════════════════════════════════════════
//  STORAGE
// ═══════════════════════════════════════════════════════════

const ONBOARDING_KEY = "scout_onboarding_completed";
const ONBOARDING_ACTIVE_KEY = "scout_onboarding_active";

function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

function markOnboardingCompleted() {
  localStorage.setItem(ONBOARDING_KEY, "true");
  localStorage.removeItem(ONBOARDING_ACTIVE_KEY);
}

function setOnboardingActive(active: boolean) {
  if (active) {
    localStorage.setItem(ONBOARDING_ACTIVE_KEY, "true");
  } else {
    localStorage.removeItem(ONBOARDING_ACTIVE_KEY);
  }
}

// ═══════════════════════════════════════════════════════════
//  SPOTLIGHT OVERLAY
// ═══════════════════════════════════════════════════════════

function SpotlightOverlay({
  targetSelector,
  children,
  position = "below",
  onSkip,
  step,
  totalSteps,
}: {
  targetSelector?: string;
  children: React.ReactNode;
  position?: "center" | "below" | "above" | "right";
  onSkip: () => void;
  step: number;
  totalSteps: number;
}) {
  const [cutout, setCutout] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!targetSelector) {
      setCutout(null);
      return;
    }

    function updateCutout() {
      const el = document.querySelector(targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCutout(rect);
      }
    }

    // Try immediately and with delays for elements that render async
    updateCutout();
    const t1 = setTimeout(updateCutout, 300);
    const t2 = setTimeout(updateCutout, 800);
    const t3 = setTimeout(updateCutout, 1500);

    window.addEventListener("resize", updateCutout);
    window.addEventListener("scroll", updateCutout, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", updateCutout);
      window.removeEventListener("scroll", updateCutout, true);
    };
  }, [targetSelector]);

  const padding = 12;

  // Calculate card position based on cutout and preference
  function getCardStyle(): React.CSSProperties {
    if (!cutout || position === "center") {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const style: React.CSSProperties = { position: "fixed" };

    if (position === "below") {
      style.top = cutout.bottom + padding + 16;
      style.left = Math.max(16, Math.min(cutout.left, window.innerWidth - 400));
    } else if (position === "above") {
      style.bottom = window.innerHeight - cutout.top + padding + 16;
      style.left = Math.max(16, Math.min(cutout.left, window.innerWidth - 400));
    } else if (position === "right") {
      style.top = cutout.top;
      style.left = cutout.right + 16;
    }

    return style;
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      {/* Dark overlay with cutout via clip-path — blocks events outside the cutout */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          pointerEvents: "auto",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          clipPath: cutout
            ? `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%,
                0% 0%,
                ${cutout.left - padding}px ${cutout.top - padding}px,
                ${cutout.left - padding}px ${cutout.bottom + padding}px,
                ${cutout.right + padding}px ${cutout.bottom + padding}px,
                ${cutout.right + padding}px ${cutout.top - padding}px,
                ${cutout.left - padding}px ${cutout.top - padding}px,
                0% 0%
              )`
            : undefined,
        }}
      />

      {/* Cutout highlight border — decorative only */}
      {cutout && (
        <div
          className="absolute rounded-xl border-2 border-gold/40 shadow-lg shadow-gold/10 transition-all duration-500"
          style={{
            top: cutout.top - padding,
            left: cutout.left - padding,
            width: cutout.width + padding * 2,
            height: cutout.height + padding * 2,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="fixed top-6 right-6 z-[10000] flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
        style={{ pointerEvents: "auto" }}
      >
        <X className="h-3 w-3" />
        Skip onboarding
      </button>

      {/* Coaching card */}
      <div
        style={{ ...getCardStyle(), pointerEvents: "auto" }}
        className="z-[10000] w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-white/10 bg-neutral-900 p-6 shadow-2xl"
      >
        {children}

        {/* Progress dots */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step
                  ? "bg-gold"
                  : i < step
                    ? "bg-gold/40"
                    : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export function OnboardingFlow() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [active, setActive] = useState(false);
  const [substep, setSubstep] = useState(0); // For multi-part steps
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isOnboardingCompleted()) {
      setActive(true);
      setOnboardingActive(true);
    }
  }, []);

  const skip = useCallback(() => {
    markOnboardingCompleted();
    setActive(false);
  }, []);

  const nextStep = useCallback(() => {
    setSubstep(0);
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next >= 4) {
        markOnboardingCompleted();
        setActive(false);
        return prev;
      }
      return next;
    });
  }, []);

  // Navigate to the correct page for each step
  useEffect(() => {
    if (!active || !mounted) return;

    const targetPages = [null, "/search", "/map", "/connections"];
    const target = targetPages[currentStep];
    if (target && pathname !== target) {
      router.push(target);
    }
  }, [active, currentStep, pathname, router, mounted]);

  if (!mounted || !active) return null;

  // ── STEP 1: Welcome ──
  if (currentStep === 0) {
    return (
      <SpotlightOverlay onSkip={skip} step={0} totalSteps={4} position="center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold">
            <Sparkles className="h-6 w-6 text-neutral-900" />
          </div>
          <h2 className="text-xl font-bold text-white">Welcome to Scout</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            You just got a superpower. Scout finds engineers other recruiters
            can&apos;t — using their actual code, not just their LinkedIn profile.
          </p>
          <div className="mt-5 space-y-3 text-left">
            {[
              { icon: Search, label: "Search", desc: "Find developers by what they've actually built" },
              { icon: Map, label: "Market Map", desc: "See the entire talent landscape for any role, instantly" },
              { icon: Link2, label: "Connections", desc: "Warm intros into any company through your network" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-neutral-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={nextStep}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </SpotlightOverlay>
    );
  }

  // ── STEP 2: Guided Search ──
  if (currentStep === 1) {
    if (pathname !== "/search") return null;

    // Substep 0: Point at search bar
    if (substep === 0) {
      return (
        <SpotlightOverlay
          targetSelector="form.relative input[type='text']"
          onSkip={skip}
          step={1}
          totalSteps={4}
          position="below"
        >
          <h3 className="text-lg font-bold text-white">Try a search</h3>
          <p className="mt-2 text-sm text-neutral-300">
            Type a role or technology into the search bar above. Try
            something like <span className="font-medium text-gold">&quot;react frontend&quot;</span> or <span className="font-medium text-gold">&quot;kubernetes engineer SF&quot;</span>.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Scout searches GitHub profiles, not LinkedIn — so you find people based on what they&apos;ve actually built.
          </p>
          <button
            onClick={() => setSubstep(1)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            I&apos;ve searched — what&apos;s next?
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </SpotlightOverlay>
      );
    }

    // Substep 1: Explain results / score
    return (
      <SpotlightOverlay
        onSkip={skip}
        step={1}
        totalSteps={4}
        position="center"
      >
        <h3 className="text-lg font-bold text-white">Scout Score</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Every developer gets a quality score based on their actual code —
          contributions, consistency, impact, and community reputation.
        </p>
        <p className="mt-2 text-sm text-neutral-300">
          This is what makes Scout different from LinkedIn. You see real
          engineering signal, not self-reported titles.
        </p>
        <button
          onClick={nextStep}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
        >
          Next: Try a Market Map
          <ArrowRight className="h-4 w-4" />
        </button>
      </SpotlightOverlay>
    );
  }

  // ── STEP 3: Guided Market Map ──
  if (currentStep === 2) {
    if (pathname !== "/map") return null;

    if (substep === 0) {
      return (
        <SpotlightOverlay
          targetSelector="input[type='text']"
          onSkip={skip}
          step={2}
          totalSteps={4}
          position="below"
        >
          <h3 className="text-lg font-bold text-white">Create a Market Map</h3>
          <p className="mt-2 text-sm text-neutral-300">
            A Market Map shows the entire talent landscape for a role. Enter a
            role you&apos;re hiring for — or try <span className="font-medium text-gold">&quot;Sr. Platform Engineer&quot;</span>.
          </p>
          <p className="mt-2 text-xs text-neutral-500">
            Scout will identify top companies, find matching engineers, score
            candidates, and flag who&apos;s likely to move.
          </p>
          <button
            onClick={() => setSubstep(1)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            I see the map — what now?
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </SpotlightOverlay>
      );
    }

    return (
      <SpotlightOverlay
        onSkip={skip}
        step={2}
        totalSteps={4}
        position="center"
      >
        <h3 className="text-lg font-bold text-white">Your talent landscape</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Scout just identified top companies, found matching engineers, scored
          every candidate, and flagged who might be open to moving.
        </p>
        <p className="mt-2 text-sm text-neutral-400 italic">
          This would take 2-3 days manually. Scout does it in 30 seconds.
        </p>
        <button
          onClick={nextStep}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
        >
          Next: Connection Mapper
          <ArrowRight className="h-4 w-4" />
        </button>
      </SpotlightOverlay>
    );
  }

  // ── STEP 4: Connection Mapper ──
  if (currentStep === 3) {
    if (pathname !== "/connections") return null;

    return (
      <SpotlightOverlay
        targetSelector="input[placeholder='yourcompany.com']"
        onSkip={skip}
        step={3}
        totalSteps={4}
        position="below"
      >
        <h3 className="text-lg font-bold text-white">Map your warm paths</h3>
        <p className="mt-2 text-sm text-neutral-300">
          Enter your company domain and Scout finds warm paths into any company —
          former colleagues, shared investors, same open source projects.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Skip this for now if you want — you can set it up anytime from the
          sidebar.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={skip}
            className="flex-1 rounded-lg bg-white/10 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            Skip for now
          </button>
          <button
            onClick={skip}
            className="flex-1 rounded-lg bg-gold py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gold-hover"
          >
            Finish tour
          </button>
        </div>
      </SpotlightOverlay>
    );
  }

  return null;
}
