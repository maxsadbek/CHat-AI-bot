"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

// ─── Payment Provider Config ─────────────────────────

interface PaymentProvider {
  id: string;
  name: string;
  emoji: string;
  description: string;
  supportedCurrencies: string[];
  availability: string[];
}

const PROVIDERS: PaymentProvider[] = [
  {
    id: "stripe",
    name: "Stripe",
    emoji: "💳",
    description: "Credit card, Apple Pay, Google Pay — Global",
    supportedCurrencies: ["USD", "EUR", "GBP"],
    availability: ["Global"],
  },
  {
    id: "telegram_stars",
    name: "Telegram Stars",
    emoji: "⭐",
    description: "Pay with Telegram Stars — Instant",
    supportedCurrencies: ["XTR"],
    availability: ["Global"],
  },
  {
    id: "click",
    name: "Click",
    emoji: "🔵",
    description: "UzCard, Humo — Uzbekistan",
    supportedCurrencies: ["UZS"],
    availability: ["UZ"],
  },
  {
    id: "payme",
    name: "Payme",
    emoji: "🟢",
    description: "Payme App — Uzbekistan",
    supportedCurrencies: ["UZS"],
    availability: ["UZ"],
  },
];

// ─── Plan Config ─────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  emoji: string;
  price: { amount: number; label: string };
}

const PLANS: Record<string, Plan> = {
  free: { id: "free", name: "Free", emoji: "🆓", price: { amount: 0, label: "Free" } },
  pro_monthly: { id: "pro_monthly", name: "Pro Monthly", emoji: "⭐", price: { amount: 999, label: "$9.99/mo" } },
  pro_yearly: { id: "pro_yearly", name: "Pro Yearly", emoji: "🌟", price: { amount: 9999, label: "$99.99/yr" } },
  lifetime: { id: "lifetime", name: "Lifetime", emoji: "👑", price: { amount: 29999, label: "$299.99" } },
};

// ─── Steps ───────────────────────────────────────────

type CheckoutStep = "select-provider" | "confirm" | "processing" | "success" | "failed";

// ─── Checkout Content (wrapped in Suspense) ──────────

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "";

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("select-provider");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Validate plan
  const plan = PLANS[planId];
  if (!plan && mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary">
        <GlassCard className="p-8 text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-white mb-2">Invalid Plan</h2>
          <p className="text-gray-400 mb-6">The selected plan does not exist.</p>
          <Link href="/premium">
            <Button variant="primary">← Back to Plans</Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!mounted || !plan) return null;

  const handleSelectProvider = (providerId: string) => {
    setSelectedProvider(providerId);
    setStep("confirm");
  };

  const handleCreatePayment = async () => {
    if (!selectedProvider || !plan) return;

    setStep("processing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          providerId: selectedProvider,
          successUrl: `${window.location.origin}/premium/success?plan=${plan.id}&provider=${selectedProvider}`,
          cancelUrl: `${window.location.origin}/premium/cancel?plan=${plan.id}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Payment creation failed");
      }

      setPaymentUrl(data.paymentUrl ?? null);

      // If there's a payment URL, redirect the user
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        // For deep links (Telegram Stars, etc.), show the session info
        setStep("success");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      setStep("failed");
    }
  };

  const handleCopyDeepLink = () => {
    if (paymentUrl) {
      navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const provider = PROVIDERS.find((p) => p.id === selectedProvider);

  // ─── Render ───────────────────────────────────────

  return (
    <main className="min-h-screen bg-primary">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link
            href="/premium"
            className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Plans
          </Link>
          <h1 className="text-3xl font-bold text-white">
            {plan.emoji} {plan.name}
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            {plan.price.label}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {["select-provider", "confirm", "processing"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  step === s || (step === "success" && i <= 2) || (step === "failed" && i <= 2)
                    ? "bg-accent text-white"
                    : "bg-white/10 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`h-px w-8 transition-all ${
                    (step !== "select-provider" && i === 0) || step === "processing" || step === "success"
                      ? "bg-accent"
                      : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step: Select Provider */}
        {step === "select-provider" && (
          <div className="animate-in">
            <h2 className="mb-6 text-xl font-semibold text-white">
              Choose Payment Method
            </h2>
            <div className="space-y-4">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-all duration-300 ${
                    selectedProvider === p.id
                      ? "border-accent bg-accent/5 ring-1 ring-accent"
                      : "border-white/5 bg-surface-card/50 hover:border-accent/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{p.emoji}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-sm text-gray-400">{p.description}</div>
                    </div>
                    <div className="flex gap-1">
                      {p.supportedCurrencies.map((c) => (
                        <span
                          key={c}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-gray-500"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && provider && (
          <div className="animate-in">
            <GlassCard className="p-6 mb-6">
              <h2 className="mb-4 text-xl font-semibold text-white">Confirm Payment</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-white font-semibold">{plan.emoji} {plan.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Payment Method</span>
                  <span className="text-white font-semibold">{provider.emoji} {provider.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Price</span>
                  <span className="text-accent-400 font-bold text-lg">{plan.price.label}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setStep("select-provider")}
                  className="flex-1"
                >
                  Change
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreatePayment}
                  className="flex-1"
                >
                  Pay {plan.price.label}
                </Button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="animate-in text-center">
            <GlassCard className="p-8">
              <div className="mb-6">
                <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Creating Payment...</h2>
              <p className="text-gray-400">
                Please wait while we create your payment session with {provider?.name}.
              </p>
              {errorMessage && (
                <p className="mt-4 text-red-400 text-sm">{errorMessage}</p>
              )}
            </GlassCard>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="animate-in text-center">
            <GlassCard className="p-8">
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Payment Created!</h2>
              <p className="text-gray-400 mb-6">
                Your payment session has been created. Complete the payment to activate
                your {plan.name} subscription.
              </p>
              {paymentUrl && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Payment Link:</p>
                  <div className="flex items-center gap-2 rounded-lg bg-white/5 p-3">
                    <code className="flex-1 truncate text-sm text-accent-300">
                      {paymentUrl}
                    </code>
                    <button
                      onClick={handleCopyDeepLink}
                      className="shrink-0 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-accent-400 hover:bg-accent/20 transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Link href={`/premium/success?plan=${plan.id}&provider=${selectedProvider}`}>
                  <Button variant="primary">I've Paid</Button>
                </Link>
                <Link href="/premium">
                  <Button variant="secondary">Back to Plans</Button>
                </Link>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Step: Failed */}
        {step === "failed" && (
          <div className="animate-in text-center">
            <GlassCard className="p-8 border-red-500/20">
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
                <span className="text-4xl">❌</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Payment Failed</h2>
              <p className="text-gray-400 mb-2">
                We couldn't create your payment session.
              </p>
              {errorMessage && (
                <p className="text-red-400 text-sm mb-6">{errorMessage}</p>
              )}
              <div className="flex gap-3 justify-center">
                <Button variant="primary" onClick={() => { setStep("select-provider"); setErrorMessage(null); }}>
                  Try Again
                </Button>
                <Link href="/premium">
                  <Button variant="secondary">Back to Plans</Button>
                </Link>
              </div>
            </GlassCard>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Page Wrapper ────────────────────────────────────

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-primary">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
