// Centralized types to avoid circular dependencies
export type SubscriptionTier = 'free' | 'pro' | 'byok' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isPro: boolean;
  isTrialing: boolean;
  isActive: boolean;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
}
