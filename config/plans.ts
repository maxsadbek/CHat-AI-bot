/**
 * Subscription Plans
 * Defines available subscription tiers, their limits, features, and pricing.
 * Payment-ready architecture — add payment provider integration here.
 */

export type PlanId = "free" | "premium" | "enterprise";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  emoji: string;
  description: string;
  price: {
    monthly: number;   // USD cents (0 = free)
    yearly: number;    // USD cents (0 = free)
  };
  limits: {
    requestsPerDay: number;
    maxConversations: number;
    maxMessageLength: number;
    tokensPerRequest: number;
  };
  features: string[];
  isActive: boolean;
}

export const SUBSCRIPTION_PLANS: Record<PlanId, SubscriptionPlan> = {
  free: {
    id: "free",
    name: "Free",
    emoji: "🆓",
    description: "Basic access to AI features",
    price: { monthly: 0, yearly: 0 },
    limits: {
      requestsPerDay: 50,
      maxConversations: 10,
      maxMessageLength: 2000,
      tokensPerRequest: 2048,
    },
    features: [
      "AI Chat with memory",
      "Image prompt generation",
      "Video prompt generation",
      "Basic coding assistance",
      "Social media content",
      "Business ideas",
      "Text translation",
    ],
    isActive: true,
  },
  premium: {
    id: "premium",
    name: "Premium",
    emoji: "⭐",
    description: "Unlimited access to all AI features",
    price: { monthly: 999, yearly: 9999 }, // $9.99/mo, $99.99/yr
    limits: {
      requestsPerDay: 500,
      maxConversations: 100,
      maxMessageLength: 4096,
      tokensPerRequest: 8192,
    },
    features: [
      "Everything in Free",
      "500 requests per day",
      "Advanced AI models",
      "Priority processing",
      "Priority support",
      "Advanced analytics",
      "Exclusive AI features",
      "No ads",
    ],
    isActive: true,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    emoji: "🏢",
    description: "Custom solutions for businesses",
    price: { monthly: 0, yearly: 0 }, // Custom pricing
    limits: {
      requestsPerDay: 999999,
      maxConversations: 9999,
      maxMessageLength: 8192,
      tokensPerRequest: 16384,
    },
    features: [
      "Everything in Premium",
      "Unlimited requests",
      "Custom AI models",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Team management",
      "White-label option",
    ],
    isActive: false, // Coming soon
  },
};

/**
 * Get the daily limit for a given subscription tier
 */
export function getDailyLimit(tier: PlanId = "free"): number {
  return SUBSCRIPTION_PLANS[tier]?.limits.requestsPerDay ?? 50;
}

/**
 * Check if a user can upgrade to a target plan
 */
export function canUpgrade(currentTier: PlanId, targetTier: PlanId): boolean {
  const tiers: PlanId[] = ["free", "premium", "enterprise"];
  const currentIdx = tiers.indexOf(currentTier);
  const targetIdx = tiers.indexOf(targetTier);
  return targetIdx > currentIdx && SUBSCRIPTION_PLANS[targetTier].isActive;
}

/**
 * All active plans (available for purchase)
 */
export function getActivePlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS).filter((p) => p.isActive);
}
