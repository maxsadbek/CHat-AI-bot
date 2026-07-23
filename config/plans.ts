/**
 * Subscription Plans
 * Defines 4 tiers: Free, Pro Monthly, Pro Yearly, Lifetime.
 * Each plan has explicit feature flags for unlimited access.
 * Payment-ready — add payment provider integration here.
 */

export type PlanId = "free" | "pro_monthly" | "pro_yearly" | "lifetime";

export type BillingPeriod = "none" | "monthly" | "yearly" | "lifetime";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  emoji: string;
  badge: string;
  description: string;
  billingPeriod: BillingPeriod;
  price: {
    amount: number;   // USD cents
    label: string;    // Display label like "$9.99/mo"
  };
  limits: {
    requestsPerDay: number;
    conversationsPerFeature: number;
  };
  features: Array<{
    key: string;
    label: string;
    included: boolean;
    emoji: string;
  }>;
  modelTier: "basic" | "all";
  priorityQueue: boolean;
  unlimitedHistory: boolean;
  isActive: boolean;
  sortOrder: number;
}

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free",
    emoji: "🆓",
    badge: "Free",
    description: "Get started with basic AI features",
    billingPeriod: "none",
    price: { amount: 0, label: "Free" },
    limits: {
      requestsPerDay: 50,
      conversationsPerFeature: 10,
    },
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
    isActive: true,
    sortOrder: 0,
  },
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro Monthly",
    emoji: "⭐",
    badge: "Pro",
    description: "Unlimited access to all AI features",
    billingPeriod: "monthly",
    price: { amount: 999, label: "$9.99/mo" },
    limits: {
      requestsPerDay: 999999,
      conversationsPerFeature: 999999,
    },
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
    isActive: true,
    sortOrder: 1,
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "Pro Yearly",
    emoji: "🌟",
    badge: "Best Value",
    description: "All Pro features, save 17% annually",
    billingPeriod: "yearly",
    price: { amount: 9999, label: "$99.99/yr" },
    limits: {
      requestsPerDay: 999999,
      conversationsPerFeature: 999999,
    },
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
    isActive: true,
    sortOrder: 2,
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    emoji: "👑",
    badge: "Lifetime",
    description: "Pay once, use forever — all Pro features",
    billingPeriod: "lifetime",
    price: { amount: 29999, label: "$299.99" },
    limits: {
      requestsPerDay: 999999,
      conversationsPerFeature: 999999,
    },
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
    isActive: true,
    sortOrder: 3,
  },
} as const;

/** Active plans sorted by price */
export function getActivePlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS)
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Get a plan by ID */
export function getPlan(planId: PlanId): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS[planId];
}

/** Get human-readable tier from plan type */
export function getTierFromPlan(planId: PlanId): string {
  if (planId === "free") return "free";
  return "pro";
}

/** Calculate expiry date based on billing period */
export function calculateExpiry(billingPeriod: BillingPeriod): Date | null {
  if (billingPeriod === "none" || billingPeriod === "lifetime") return null;
  const now = new Date();
  if (billingPeriod === "monthly") {
    now.setMonth(now.getMonth() + 1);
  } else if (billingPeriod === "yearly") {
    now.setFullYear(now.getFullYear() + 1);
  }
  return now;
}

/** Check if a plan has unlimited requests */
export function hasUnlimitedRequests(planId: PlanId): boolean {
  return planId !== "free";
}

/** Get daily request limit for a plan */
export function getDailyLimit(planId: PlanId = "free"): number {
  return SUBSCRIPTION_PLANS[planId]?.limits.requestsPerDay ?? 50;
}
