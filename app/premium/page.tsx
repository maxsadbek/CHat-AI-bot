"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

interface Plan {
  id: string;
  name: string;
  emoji: string;
  badge: string;
  description: string;
  price: { amount: number; label: string };
  features: Array<{ key: string; label: string; included: boolean; emoji: string }>;
  modelTier: string;
  priorityQueue: boolean;
  unlimitedHistory: boolean;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    emoji: "🆓",
    badge: "Free",
    description: "Get started with basic AI features",
    price: { amount: 0, label: "Free" },
    features: [
      { key: "chat", label: "AI Chat", included: true, emoji: "🤖" },
      { key: "image", label: "Image AI", included: true, emoji: "🎨" },
      { key: "video", label: "Video AI", included: true, emoji: "🎬" },
      { key: "coding", label: "Coding", included: true, emoji: "💻" },
      { key: "social", label: "Social Media", included: true, emoji: "📱" },
      { key: "business", label: "Business", included: true, emoji: "💼" },
      { key: "translate", label: "Translate", included: true, emoji: "🌍" },
      { key: "history", label: "Conversation History", included: true, emoji: "📋" },
      { key: "models", label: "Latest AI Models", included: false, emoji: "🤖" },
      { key: "priority", label: "Priority Queue", included: false, emoji: "⚡" },
    ],
    modelTier: "basic",
    priorityQueue: false,
    unlimitedHistory: false,
  },
  {
    id: "pro_monthly",
    name: "Pro Monthly",
    emoji: "⭐",
    badge: "Pro",
    description: "Unlimited access to all AI features",
    price: { amount: 999, label: "$9.99/mo" },
    features: [
      { key: "chat", label: "Unlimited AI Chat", included: true, emoji: "🤖" },
      { key: "image", label: "Unlimited Image AI", included: true, emoji: "🎨" },
      { key: "video", label: "Unlimited Video AI", included: true, emoji: "🎬" },
      { key: "coding", label: "Unlimited Coding", included: true, emoji: "💻" },
      { key: "social", label: "Unlimited Social Media", included: true, emoji: "📱" },
      { key: "business", label: "Unlimited Business", included: true, emoji: "💼" },
      { key: "translate", label: "Unlimited Translate", included: true, emoji: "🌍" },
      { key: "history", label: "Unlimited History", included: true, emoji: "📋" },
      { key: "models", label: "Latest AI Models", included: true, emoji: "🤖" },
      { key: "priority", label: "Priority Queue", included: true, emoji: "⚡" },
    ],
    modelTier: "all",
    priorityQueue: true,
    unlimitedHistory: true,
  },
  {
    id: "pro_yearly",
    name: "Pro Yearly",
    emoji: "🌟",
    badge: "Best Value",
    description: "All Pro features, save 17% annually",
    price: { amount: 9999, label: "$99.99/yr" },
    features: [
      { key: "chat", label: "Unlimited AI Chat", included: true, emoji: "🤖" },
      { key: "image", label: "Unlimited Image AI", included: true, emoji: "🎨" },
      { key: "video", label: "Unlimited Video AI", included: true, emoji: "🎬" },
      { key: "coding", label: "Unlimited Coding", included: true, emoji: "💻" },
      { key: "social", label: "Unlimited Social Media", included: true, emoji: "📱" },
      { key: "business", label: "Unlimited Business", included: true, emoji: "💼" },
      { key: "translate", label: "Unlimited Translate", included: true, emoji: "🌍" },
      { key: "history", label: "Unlimited History", included: true, emoji: "📋" },
      { key: "models", label: "Latest AI Models", included: true, emoji: "🤖" },
      { key: "priority", label: "Priority Queue", included: true, emoji: "⚡" },
    ],
    modelTier: "all",
    priorityQueue: true,
    unlimitedHistory: true,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    emoji: "👑",
    badge: "Lifetime",
    description: "Pay once, use forever",
    price: { amount: 29999, label: "$299.99" },
    features: [
      { key: "chat", label: "Unlimited AI Chat", included: true, emoji: "🤖" },
      { key: "image", label: "Unlimited Image AI", included: true, emoji: "🎨" },
      { key: "video", label: "Unlimited Video AI", included: true, emoji: "🎬" },
      { key: "coding", label: "Unlimited Coding", included: true, emoji: "💻" },
      { key: "social", label: "Unlimited Social Media", included: true, emoji: "📱" },
      { key: "business", label: "Unlimited Business", included: true, emoji: "💼" },
      { key: "translate", label: "Unlimited Translate", included: true, emoji: "🌍" },
      { key: "history", label: "Unlimited History", included: true, emoji: "📋" },
      { key: "models", label: "Latest AI Models", included: true, emoji: "🤖" },
      { key: "priority", label: "Priority Queue", included: true, emoji: "⚡" },
    ],
    modelTier: "all",
    priorityQueue: true,
    unlimitedHistory: true,
  },
];

export default function PremiumPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const paidPlans = PLANS.filter((p) => p.id !== "free");

  return (
    <main className="min-h-screen bg-primary">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-16 pb-8 sm:px-6 sm:pt-24 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-sm text-accent-300">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            Premium Plans
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            <span className="text-gradient">Unlock</span> Premium AI
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
            Choose the plan that fits your needs. All plans include unlimited access
            to our complete AI feature set.
          </p>
        </div>
      </section>

      {/* Plans Grid */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {paidPlans.map((plan, index) => (
              <div
                key={plan.id}
                className="group animate-in"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => setSelectedPlan(plan.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedPlan(plan.id); }}
              >
                <GlassCard
                  className={`relative overflow-hidden p-6 transition-all duration-500 cursor-pointer ${
                    selectedPlan === plan.id
                      ? "ring-2 ring-accent shadow-lg shadow-accent/20"
                      : "hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5"
                  }`}
                  hover
                >
                  {/* Badge */}
                  {plan.badge !== plan.name && (
                    <div className="absolute top-4 right-4 rounded-full bg-gradient-to-r from-accent to-secondary px-3 py-1 text-xs font-semibold text-white">
                      {plan.badge}
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-6">
                    <span className="text-4xl">{plan.emoji}</span>
                    <h3 className="mt-3 text-xl font-bold text-white">{plan.name}</h3>
                    <p className="mt-1 text-sm text-gray-400">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-white">{plan.price.label}</span>
                  </div>

                  {/* Features */}
                  <div className="mb-8 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature.key} className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                            feature.included
                              ? "bg-accent/10 text-accent-400"
                              : "bg-white/5 text-gray-600"
                          }`}
                        >
                          {feature.included ? "✓" : "—"}
                        </span>
                        <span
                          className={`text-sm ${
                            feature.included ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          {feature.emoji} {feature.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/premium/checkout?plan=${plan.id}`}
                    className="group/btn relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-white transition-all duration-300 hover:bg-accent-600 hover:shadow-lg hover:shadow-accent/25"
                  >
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-secondary opacity-0 transition-opacity group-hover/btn:opacity-100" />
                    <span className="relative flex items-center gap-2">
                      Subscribe Now
                      <svg className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </Link>
                </GlassCard>
              </div>
            ))}
          </div>

          {/* Feature Comparison */}
          <div className="mt-16">
            <h2 className="mb-8 text-center text-2xl font-bold text-white">
              Full Feature Comparison
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="pb-4 pr-4 font-semibold text-gray-400">Feature</th>
                    {PLANS.map((plan) => (
                      <th key={plan.id} className="pb-4 px-4 font-semibold text-white text-center">
                        {plan.emoji} {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-4 pr-4 text-gray-300">Price</td>
                    {PLANS.map((plan) => (
                      <td key={plan.id} className="py-4 px-4 text-center text-gray-400">
                        {plan.price.label}
                      </td>
                    ))}
                  </tr>
                  {PLANS[0]!.features.map((feature) => (
                    <tr key={feature.key} className="border-b border-white/5">
                      <td className="py-4 pr-4 text-gray-300">{feature.emoji} {feature.label.replace("Unlimited ", "")}</td>
                      {PLANS.map((plan) => {
                        const f = plan.features.find((pf) => pf.key === feature.key);
                        return (
                          <td key={plan.id} className="py-4 px-4 text-center">
                            {f?.included ? (
                              <span className="text-accent-400 font-bold">✓</span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-12 text-center">
            <p className="mb-6 text-gray-400">
              All plans include unlimited access to all AI features. No hidden fees.
            </p>
            <Link href="/">
              <Button variant="secondary" size="lg">
                ← Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
