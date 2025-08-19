import type { SubscriptionTier, SubscriptionStatus, SubscriptionInfo } from './types';
import type { User } from './schema';

// Re-export types for convenience
export type { SubscriptionTier, SubscriptionStatus, SubscriptionInfo };

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
  const isTrialing = user.trialEndsAt ? new Date(user.trialEndsAt) > new Date() : false;
  
  // Fix: If user has pro tier, they should be considered active regardless of status
  // This prevents the "pro but inactive" issue
  const isActive = isPro || status === 'active' || isTrialing;

  return {
    tier,
    status,
    isPro,
    isTrialing: isTrialing || false,
    isActive: isActive || false,
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

/**
 * Check if user has already used a free trial
 */
export function hasUsedFreeTrial(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // Check if user has ever had a trial (trialEndsAt field exists and is in the past)
  if (user.trialEndsAt) {
    const trialEndDate = new Date(user.trialEndsAt);
    return trialEndDate < new Date(); // Trial has ended
  }
  
  // Check if user has ever been on a paid tier (indicates they've used trial before)
  const hasBeenPaid = user.subscriptionTier === 'pro' || user.subscriptionTier === 'byok' || user.subscriptionTier === 'enterprise';
  
  return hasBeenPaid;
}

/**
 * Check if user can start a new free trial
 */
export function canStartFreeTrial(user: User | null | undefined): boolean {
  if (!user) return false;
  
  // Can't start trial if already on paid tier
  const isPaid = user.subscriptionTier === 'pro' || user.subscriptionTier === 'byok' || user.subscriptionTier === 'enterprise';
  if (isPaid) return false;
  
  // Can't start trial if already used one
  return !hasUsedFreeTrial(user);
}
