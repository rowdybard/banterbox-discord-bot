import type { SubscriptionTier, SubscriptionStatus } from './billing';
import type { User } from './schema';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isPro: boolean;
  isTrialing: boolean;
  isActive: boolean;
  trialEndsAt?: Date;
  currentPeriodEnd?: Date;
}

/**
 * Centralized subscription helper - SINGLE SOURCE OF TRUTH
 */
export function getSubscriptionInfo(user: User | null | undefined): SubscriptionInfo {
  if (!user) {
    return {
      tier: 'free',
      status: 'active',
      isPro: false,
      isTrialing: false,
      isActive: true,
    };
  }

  const tier = (user.subscriptionTier as SubscriptionTier) || 'free';
  const status = (user.subscriptionStatus as SubscriptionStatus) || 'active';
  const isPro = tier === 'pro' || tier === 'byok' || tier === 'enterprise';
  const isTrialing = user.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  const isActive = status === 'active';

  return {
    tier,
    status,
    isPro,
    isTrialing,
    isActive,
    trialEndsAt: user.trialEndsAt ? new Date(user.trialEndsAt) : undefined,
    currentPeriodEnd: user.currentPeriodEnd ? new Date(user.currentPeriodEnd) : undefined,
  };
}

/**
 * Check if user has Pro access
 */
export function isProUser(user: User | null | undefined): boolean {
  return getSubscriptionInfo(user).isPro;
}

/**
 * Check if user can access a specific feature
 */
export function canAccessFeature(user: User | null | undefined, feature: 'elevenlabs' | 'customVoices' | 'customPersonalities' | 'unlimitedBanters' | 'multipleDiscordServers' | 'prioritySupport'): boolean {
  const { isPro } = getSubscriptionInfo(user);
  
  switch (feature) {
    case 'elevenlabs':
    case 'customVoices':
    case 'customPersonalities':
    case 'unlimitedBanters':
    case 'multipleDiscordServers':
    case 'prioritySupport':
      return isPro;
    default:
      return false;
  }
}

/**
 * Get user's subscription tier
 */
export function getSubscriptionTier(user: User | null | undefined): SubscriptionTier {
  return getSubscriptionInfo(user).tier;
}

/**
 * Check if user is currently trialing
 */
export function isTrialing(user: User | null | undefined): boolean {
  return getSubscriptionInfo(user).isTrialing;
}

/**
 * Check if subscription is active
 */
export function isSubscriptionActive(user: User | null | undefined): boolean {
  return getSubscriptionInfo(user).isActive;
}
