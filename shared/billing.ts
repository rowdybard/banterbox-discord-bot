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
}

export const BILLING_CONFIG: BillingConfig = {
  trialDays: 7,
  currency: 'USD',
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
