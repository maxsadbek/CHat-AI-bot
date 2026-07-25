"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

// ─── Plan Config ─────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  emoji: string;
  price: { amount: number; label: string };
  description: string;
  savings?: string;
}

const PLANS: Record<string, Plan> = {
  free: { id: "free", name: "Free", emoji: "🆓", price: { amount: 0, label: "Free" }, description: "Basic AI features" },
  pro_monthly: { id: "pro_monthly", name: "Pro Monthly", emoji: "⭐", price: { amount: 99, label: "$0.99/mo" }, description: "Unlimited AI access" },
  pro_yearly: { id: "pro_yearly", name: "Pro Yearly", emoji: "🌟", price: { amount: 999, label: "$9.99/yr" }, description: "Save over 15% — best value", savings: "🔥 Save $1.89/yr vs monthly" },
  lifetime: { id: "lifetime", name: "Lifetime", emoji: "👑", price: { amount: 29999, label: "$299.99" }, description: "Pay once, use forever" },
};

// ─── Steps ───────────────────────────────────────────

type CheckoutStep = "review" | "processing" | "success" | "failed";

// ─── Checkout Content (wrapped in Suspense) ──────────

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "";

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("review");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            <Button variant="primary" size="lg">← Back to Plans</Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  if (!mounted || !plan) return null;

  const handleSecureCheckout = async () => {
    setStep("processing");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          providerId: "stripe",
          successUrl: `${window.location.origin}/premium/success?plan=${plan.id}&provider=stripe`,
          cancelUrl: `${window.location.origin}/premium/cancel?plan=${plan.id}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Payment creation failed");
      }

      setPaymentUrl(data.paymentUrl ?? null);

      // Redirect to Stripe Checkout
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        // Fallback for deep links
        setStep("success");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      setStep("failed");
    }
  };

  // ─── Render ───────────────────────────────────────

  return (
    <main className="min-h-screen bg-primary">
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/premium"
          className="mb-8 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Plans
        </Link>

        {/* Step: Review & Confirm */}
        {step === "review" && (
          <div className="animate-in">
            {/* Order Summary */}
            <GlassCard className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-6">Order Summary</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{plan.emoji}</span>
                    <div>
                      <div className="font-semibold text-white">{plan.name}</div>
                      <div className="text-sm text-gray-400">{plan.description}</div>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white">{plan.price.label}</span>
                </div>

                {plan.savings && (
                  <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/5 rounded-lg px-3 py-2">
                    <span>🔥</span>
                    <span>{plan.savings}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-medium">{plan.price.label}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Tax</span>
                  <span className="text-gray-400">Calculated at checkout</span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <span className="font-semibold text-white">Total</span>
                  <span className="text-2xl font-bold text-white">{plan.price.label}</span>
                </div>
              </div>
            </GlassCard>

            {/* Secure Checkout Notice */}
            <GlassCard className="p-6 mb-6 border-accent/10 bg-accent/[0.02]">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <span className="text-lg">🔒</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Secure Payment Powered by Stripe</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Your payment information is encrypted and never stored by Kayzel Creator.
                    All transactions are processed securely through Stripe.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                <span>🔐 SSL Encrypted</span>
                <span>✓ PCI Compliant</span>
                <span>💳 Cards · Apple Pay · Google Pay</span>
              </div>
            </GlassCard>

            {/* CTA */}
            <button
              onClick={handleSecureCheckout}
              className="group/btn relative w-full inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-accent to-secondary px-8 py-4 text-lg font-bold text-white transition-all duration-300 hover:shadow-xl hover:shadow-accent/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-3">
                <span>🚀</span>
                <span>Subscribe Securely — {plan.price.label}</span>
              </span>
            </button>

            <p className="mt-4 text-center text-xs text-gray-500">
              🔒 Your payment is protected by Stripe. You can cancel anytime.
            </p>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="animate-in text-center">
            <GlassCard className="p-8">
              <div className="mb-6">
                <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-accent/30 border-t-accent" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Redirecting to Secure Checkout...</h2>
              <p className="text-gray-400">
                Please wait while we redirect you to our secure payment page.
              </p>
              {errorMessage && (
                <p className="mt-4 text-red-400 text-sm">{errorMessage}</p>
              )}
            </GlassCard>
          </div>
        )}

        {/* Step: Success (fallback — usually Stripe handles this) */}
        {step === "success" && (
          <div className="animate-in text-center">
            <GlassCard className="p-8">
              <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Payment Session Created</h2>
              <p className="text-gray-400 mb-6">
                Your payment session has been created. Complete the payment to activate
                your {plan.name} subscription.
              </p>
              {paymentUrl && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Payment Link:</p>
                  <div className="rounded-lg bg-white/5 p-3">
                    <code className="text-sm text-accent-300 break-all">
                      {paymentUrl}
                    </code>
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Link href={`/premium/success?plan=${plan.id}&provider=stripe`}>
                  <Button variant="primary">I&apos;ve Completed Payment</Button>
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
              <h2 className="text-2xl font-bold text-white mb-2">Checkout Failed</h2>
              <p className="text-gray-400 mb-2">
                We couldn&apos;t process your request.
              </p>
              {errorMessage && (
                <p className="text-red-400 text-sm mb-6">{errorMessage}</p>
              )}
              <div className="flex gap-3 justify-center">
                <Button variant="primary" onClick={() => { setStep("review"); setErrorMessage(null); }}>
                  🔄 Try Again
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
