"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  pro_monthly: "Pro Monthly",
  pro_yearly: "Pro Yearly",
  lifetime: "Lifetime",
};

function CancelContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "pro_monthly";

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const planName = PLAN_NAMES[plan] ?? plan.replace("_", " ");

  return (
    <main className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-in">
        <GlassCard className="p-8 text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10">
            <span className="text-4xl">🕊️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Checkout Cancelled</h2>
          <p className="text-gray-400 mb-2">
            Your payment was not completed. No charges have been made.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            You can try again whenever you&apos;re ready for the{" "}
            <span className="text-accent-400 font-semibold">{planName}</span> plan.
          </p>
          <div className="flex flex-col gap-3">
            <Link href={`/premium/checkout?plan=${plan}`}>
              <Button variant="primary" size="lg" className="w-full">
                🔄 Try Again
              </Button>
            </Link>
            <Link href="/premium">
              <Button variant="secondary" size="lg" className="w-full">
                ← Compare Plans
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="md" className="w-full text-gray-400">
                Back to Home
              </Button>
            </Link>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-primary">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
        </div>
      }
    >
      <CancelContent />
    </Suspense>
  );
}
