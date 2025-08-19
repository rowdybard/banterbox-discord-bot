import type { SubscriptionTier, SubscriptionStatus } from './types';

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: {
    dailyBanters: number;
    monthlyBanters: number;
    openaiTokens: number;
    elevenlabsCharacters: number;
    audioMinutes: number;
    customVoices: number;
    customPersonalities: number;
    discordServers: number;
    prioritySupport: boolean;
  };
  restrictions: string[];
  popular?: boolean;
}

export interface BillingConfig {
  tiers: Record<SubscriptionTier, PricingTier>;
  trialDays: number;
  currency: string;
  stripePublishableKey?: string;
  planSwitching: {
    maxChangesPerMonth: number;
    cooldownDays: number; // Days between plan changes
  };
}

export const BILLING_CONFIG: BillingConfig = {
  trialDays: 7,
  currency: 'USD',
  planSwitching: {
    maxChangesPerMonth: 3, // Allow up to 3 plan changes per month
    cooldownDays: 7, // 7 days between plan changes
  },
  tiers: {
    free: {
      id: 'free',
      name: 'Free',
      description: 'Perfect for getting started with basic streaming features',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [
        '50 banters per day',
        'OpenAI TTS voices',
        'Basic overlay themes',
        'Twitch integration',
        'Discord integration (1 server)',
        'Basic personality presets',
        'Community support'
      ],
      limits: {
        dailyBanters: 50,
        monthlyBanters: 1500,
        openaiTokens: 100000,
        elevenlabsCharacters: 0,
        audioMinutes: 60,
        customVoices: 0,
        customPersonalities: 0,
        discordServers: 1,
        prioritySupport: false
      },
      restrictions: [
        'No ElevenLabs premium voices',
        'No custom voice cloning',
        'Limited overlay customization',
        'No priority generation',
        'No advanced analytics'
      ]
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      description: 'Unlock premium voices, unlimited banters, and advanced features',
      monthlyPrice: 9.99,
      yearlyPrice: 99.99,
      features: [
        'Unlimited daily banters',
        'ElevenLabs premium voices',
        'Custom voice cloning',
        'Advanced overlay customization',
        'Priority generation speed',
        'Custom personality creation',
        'Advanced analytics',
        'Priority support',
        'Discord integration (unlimited servers)',
        'Voice marketplace access'
      ],
      limits: {
        dailyBanters: 999999,
        monthlyBanters: 999999,
        openaiTokens: 1000000,
        elevenlabsCharacters: 500000,
        audioMinutes: 1000,
        customVoices: 10,
        customPersonalities: 20,
        discordServers: 999999,
        prioritySupport: true
      },
      restrictions: [
        'Uses our API keys (included in price)',
        'No enterprise features'
      ],
      popular: true
    },
    byok: {
      id: 'byok',
      name: 'Bring Your Own Key',
      description: 'Use your own API keys for maximum control and cost efficiency',
      monthlyPrice: 4.99,
      yearlyPrice: 49.99,
      features: [
        'Unlimited daily banters',
        'Use your own OpenAI API key',
        'Use your own ElevenLabs API key',
        'Advanced overlay customization',
        'Priority generation speed',
        'Custom personality creation',
        'Advanced analytics',
        'Priority support',
        'Discord integration (unlimited servers)',
        'Voice marketplace access',
        'No usage limits on your keys'
      ],
      limits: {
        dailyBanters: 999999,
        monthlyBanters: 999999,
        openaiTokens: 999999999,
        elevenlabsCharacters: 999999999,
        audioMinutes: 999999,
        customVoices: 50,
        customPersonalities: 100,
        discordServers: 999999,
        prioritySupport: true
      },
      restrictions: [
        'You pay for your own API usage',
        'Requires API key setup',
        'No enterprise features'
      ]
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for large streamers and organizations',
      monthlyPrice: 49.99,
      yearlyPrice: 499.99,
      features: [
        'Everything in Pro + BYOK',
        'Custom integrations',
        'White-label options',
        'Dedicated support',
        'Custom feature development',
        'Team management',
        'Advanced analytics dashboard',
        'API access',
        'SLA guarantees',
        'Onboarding assistance'
      ],
      limits: {
        dailyBanters: 999999999,
        monthlyBanters: 999999999,
        openaiTokens: 999999999,
        elevenlabsCharacters: 999999999,
        audioMinutes: 999999999,
        customVoices: 999999,
        customPersonalities: 999999,
        discordServers: 999999,
        prioritySupport: true
      },
      restrictions: [
        'Contact sales for custom pricing',
        'Annual contracts available'
      ]
    }
  }
};

export function getTierConfig(tier: SubscriptionTier): PricingTier {
  return BILLING_CONFIG.tiers[tier];
}

export function isFeatureAvailable(tier: SubscriptionTier, feature: keyof PricingTier['limits']): boolean {
  const config = getTierConfig(tier);
  return config.limits[feature] > 0;
}

export function getUsageLimit(tier: SubscriptionTier, feature: keyof PricingTier['limits']): number {
  const config = getTierConfig(tier);
  return config.limits[feature];
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(price);
}

export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyMonthlyEquivalent = yearlyPrice / 12;
  return Math.round(((monthlyPrice - yearlyMonthlyEquivalent) / monthlyPrice) * 100);
}

export function isProOrHigher(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'byok' || tier === 'enterprise';
}

export function canUseElevenLabs(tier: SubscriptionTier): boolean {
  return isProOrHigher(tier);
}

export function canUseCustomVoices(tier: SubscriptionTier): boolean {
  return isProOrHigher(tier);
}

export function canUseCustomPersonalities(tier: SubscriptionTier): boolean {
  return isProOrHigher(tier);
}

export function canUseUnlimitedBanters(tier: SubscriptionTier): boolean {
  return isProOrHigher(tier);
}

export function canUseMultipleDiscordServers(tier: SubscriptionTier): boolean {
  return isProOrHigher(tier);
}

export function hasPrioritySupport(tier: SubscriptionTier): boolean {
  return isProOrHigher(tier);
}

export function getTierOrder(tier: SubscriptionTier): number {
  switch (tier) {
    case 'free': return 0;
    case 'pro': return 1;
    case 'byok': return 1; // BYOK is same level as Pro, not higher
    case 'enterprise': return 2;
    default: return 0;
  }
}

export function canUpgradeTo(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
  const currentOrder = getTierOrder(currentTier);
  const targetOrder = getTierOrder(targetTier);
  return targetOrder > currentOrder;
}

export function isDowngrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
  // Special case: BYOK can downgrade to Pro or Free
  if (currentTier === 'byok') {
    return targetTier === 'pro' || targetTier === 'free';
  }
  
  // Special case: Pro can downgrade to Free
  if (currentTier === 'pro') {
    return targetTier === 'free';
  }
  
  // Enterprise can downgrade to any tier
  if (currentTier === 'enterprise') {
    return targetTier === 'byok' || targetTier === 'pro' || targetTier === 'free';
  }
  
  // Free cannot downgrade
  return false;
}

export function canDowngradeTo(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
  return isDowngrade(currentTier, targetTier);
}

export function canChangePlan(
  currentTier: SubscriptionTier, 
  targetTier: SubscriptionTier, 
  lastPlanChangeAt?: Date | null,
  planChangeCount: number = 0
): { allowed: boolean; reason?: string; nextAllowedDate?: Date } {
  // Check if it's a valid plan change
  if (currentTier === targetTier) {
    return { allowed: false, reason: "You're already on this plan" };
  }

  // Enterprise users are never restricted from changing plans
  // This ensures enterprise customers have full flexibility
  if (currentTier === 'enterprise' || targetTier === 'enterprise') {
    return { allowed: true };
  }

  // Check cooldown period FIRST (applies to all plan changes except enterprise)
  if (lastPlanChangeAt) {
    const cooldownMs = BILLING_CONFIG.planSwitching.cooldownDays * 24 * 60 * 60 * 1000;
    const nextAllowedDate = new Date(lastPlanChangeAt.getTime() + cooldownMs);
    
    if (new Date() < nextAllowedDate) {
      return { 
        allowed: false, 
        reason: `Plan changes are limited to once every ${BILLING_CONFIG.planSwitching.cooldownDays} days`,
        nextAllowedDate 
      };
    }
  }

  // Check monthly limit SECOND (applies to all plan changes except enterprise)
  if (planChangeCount >= BILLING_CONFIG.planSwitching.maxChangesPerMonth) {
    return { 
      allowed: false, 
      reason: `You've reached the monthly limit of ${BILLING_CONFIG.planSwitching.maxChangesPerMonth} plan changes` 
    };
  }

  // Check if it's a valid downgrade
  if (isDowngrade(currentTier, targetTier)) {
    return { allowed: true };
  }

  // Check if it's a valid upgrade
  if (canUpgradeTo(currentTier, targetTier)) {
    return { allowed: true };
  }

  // If we get here, it's not a valid plan change
  return { allowed: false, reason: "Invalid plan change" };
}

export function getPlanChangeInfo(
  lastPlanChangeAt?: Date | null,
  planChangeCount: number = 0,
  currentTier?: SubscriptionTier
): {
  changesThisMonth: number;
  maxChangesPerMonth: number;
  daysUntilNextChange: number | null;
  canChangeNow: boolean;
  reason?: string;
} {
  const maxChanges = BILLING_CONFIG.planSwitching.maxChangesPerMonth;
  const cooldownDays = BILLING_CONFIG.planSwitching.cooldownDays;
  
  let daysUntilNextChange: number | null = null;
  let canChangeNow = true;
  let reason: string | undefined;

  // Enterprise users are never restricted from changing plans
  if (currentTier === 'enterprise') {
    return {
      changesThisMonth: planChangeCount,
      maxChangesPerMonth: maxChanges,
      daysUntilNextChange: null,
      canChangeNow: true,
      reason: undefined
    };
  }

  // Check cooldown period
  if (lastPlanChangeAt) {
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const nextAllowedDate = new Date(lastPlanChangeAt.getTime() + cooldownMs);
    const now = new Date();
    
    if (now < nextAllowedDate) {
      const diffMs = nextAllowedDate.getTime() - now.getTime();
      daysUntilNextChange = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      canChangeNow = false;
      reason = `Plan changes are limited to once every ${cooldownDays} days`;
    }
  }

  // Check monthly limit
  if (planChangeCount >= maxChanges) {
    canChangeNow = false;
    reason = `You've reached the monthly limit of ${maxChanges} plan changes`;
  }

  return {
    changesThisMonth: planChangeCount,
    maxChangesPerMonth: maxChanges,
    daysUntilNextChange,
    canChangeNow,
    reason
  };
}
