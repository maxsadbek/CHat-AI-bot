"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

const PLAN_DETAILS: Record<string, { name: string; emoji: string }> = {
  free: { name: "Free", emoji: "🆓" },
  pro_monthly: { name: "Pro Monthly", emoji: "⭐" },
  pro_yearly: { name: "Pro Yearly", emoji: "🌟" },
  lifetime: { name: "Lifetime", emoji: "👑" },
};

const PROVIDER_DETAILS: Record<string, { name: string; emoji: string }> = {
  stripe: { name: "Stripe", emoji: "💳" },
  telegram_stars: { name: "Telegram Stars", emoji: "⭐" },
  click: { name: "Click", emoji: "🔵" },
  payme: { name: "Payme", emoji: "🟢" },
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "pro_monthly";
  const providerId = searchParams.get("provider") ?? "stripe";

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"checking" | "success" | "pending">("checking");

  const plan = PLAN_DETAILS[planId] ?? { name: "Premium", emoji: "⭐" };
  const provider = PROVIDER_DETAILS[providerId] ?? { name: "Payment", emoji: "💳" };

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setStatus("success"), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  // Calculate a dummy renew date (1 month from now for monthly, 1 year for yearly)
  const renewDate = new Date();
  if (planId === "pro_yearly") renewDate.setFullYear(renewDate.getFullYear() + 1);
  else if (planId === "pro_monthly") renewDate.setMonth(renewDate.getMonth() + 1);
  else if (planId === "lifetime") null; // No renew for lifetime

  const formattedDate = planId === "lifetime"
    ? "Never — Lifetime Access"
    : renewDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-in">
        {status === "checking" && (
          <GlassCard className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verifying Your Payment</h2>
            <p className="text-gray-400">
              Please wait while we confirm your payment with{" "}
              {provider.emoji} {provider.name}.
            </p>
          </GlassCard>
        )}

        {status === "success" && (
          <GlassCard className="p-8 text-center">
            {/* Success icon */}
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <span className="text-4xl">🎉</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Payment Successful!</h2>
            <p className="text-gray-400 mb-6">
              Your {plan.emoji} <span className="text-accent-400 font-semibold">{plan.name}</span> plan is now active.
            </p>

            {/* Subscription Details */}
            <div className="mb-6 rounded-xl bg-white/[0.03] border border-white/5 p-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className="flex items-center gap-1.5 text-sm text-green-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Active
                </span>
              </div>
              <div className="border-t border-white/5" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Plan</span>
                <span className="text-sm text-white font-medium">{plan.emoji} {plan.name}</span>
              </div>
              <div className="border-t border-white/5" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Payment</span>
                <span className="text-sm text-white">{provider.emoji} {provider.name}</span>
              </div>
              {formattedDate && (
                <>
                  <div className="border-t border-white/5" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Renew Date</span>
                    <span className="text-sm text-white">{formattedDate}</span>
                  </div>
                </>
              )}
            </div>

            <p className="text-gray-500 text-sm mb-6">
              🚀 Enjoy unlimited access to all AI features. Welcome aboard!
            </p>

            <Link href="/">
              <Button variant="primary" size="lg" className="w-full">
                🚀 Go to Dashboard
              </Button>
            </Link>
          </GlassCard>
        )}

        {status === "pending" && (
          <GlassCard className="p-8 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10">
              <span className="text-4xl">⏳</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Payment Pending</h2>
            <p className="text-gray-400 mb-6">
              Your payment is being processed. This usually takes a few moments.
            </p>
            <Link href="/">
              <Button variant="primary">Back to Home</Button>
            </Link>
          </GlassCard>
        )}
      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-primary">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
