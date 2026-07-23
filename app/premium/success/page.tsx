"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "pro_monthly";
  const provider = searchParams.get("provider") ?? "stripe";

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"checking" | "success" | "pending" | "failed">("checking");

  useEffect(() => {
    setMounted(true);

    // Simulate payment verification check
    const timer = setTimeout(() => {
      setStatus("success");
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  const planNames: Record<string, string> = {
    free: "Free",
    pro_monthly: "Pro Monthly",
    pro_yearly: "Pro Yearly",
    lifetime: "Lifetime",
  };

  const providerEmojis: Record<string, string> = {
    stripe: "💳",
    telegram_stars: "⭐",
    click: "🔵",
    payme: "🟢",
  };

  const providerNames: Record<string, string> = {
    stripe: "Stripe",
    telegram_stars: "Telegram Stars",
    click: "Click",
    payme: "Payme",
  };

  return (
    <main className="min-h-screen bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-in">
        {status === "checking" && (
          <GlassCard className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verifying Payment</h2>
            <p className="text-gray-400">
              Please wait while we confirm your payment with{" "}
              {providerEmojis[provider] ?? "💳"} {providerNames[provider] ?? provider}.
            </p>
          </GlassCard>
        )}

        {status === "success" && (
          <GlassCard className="p-8 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
            <p className="text-gray-400 mb-4">
              Your <span className="text-accent-400 font-semibold">{planNames[plan] ?? plan}</span>{" "}
              subscription is now active.
            </p>
            <div className="mb-6 rounded-lg bg-white/5 p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Status</span>
                <span className="text-green-400 font-semibold">Active</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500">Plan</span>
                <span className="text-white">{planNames[plan] ?? plan}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Payment</span>
                <span className="text-white">
                  {providerEmojis[provider] ?? "💳"} {providerNames[provider] ?? provider}
                </span>
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              Enjoy unlimited access to all AI features!
            </p>
            <Link href="/">
              <Button variant="primary" size="lg">
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

        {status === "failed" && (
          <GlassCard className="p-8 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Payment Verification Failed</h2>
            <p className="text-gray-400 mb-6">
              We couldn't verify your payment. Please contact support.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/premium/checkout">
                <Button variant="primary">Try Again</Button>
              </Link>
              <Link href="/">
                <Button variant="secondary">Back to Home</Button>
              </Link>
            </div>
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
