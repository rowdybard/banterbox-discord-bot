import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Check, 
  X, 
  Mic, 
  Infinity, 
  Palette, 
  Zap,
  ArrowLeft,
  Star,
  Users,
  Clock
} from "lucide-react";

export default function ProPage() {
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(false);

  const monthlyPrice = 9.99;
  const yearlyPrice = 99.99;
  const yearlyMonthlyEquivalent = yearlyPrice / 12;
  const savings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  const features = [
    {
      category: "Generation",
      items: [
        { feature: "Daily banter generation", free: "50 per day", pro: "Unlimited" },
        { feature: "Custom banter prompts", free: false, pro: true },
        { feature: "Priority generation speed", free: false, pro: true },
      ]
    },
    {
      category: "Voice & Audio",
      items: [
        { feature: "OpenAI TTS voices", free: true, pro: true },
        { feature: "ElevenLabs premium voices", free: false, pro: true },
        { feature: "Custom voice cloning", free: false, pro: true },
        { feature: "Audio quality", free: "Standard", pro: "Premium HD" },
      ]
    },
    {
      category: "Customization",
      items: [
        { feature: "Overlay themes", free: "3 basic", pro: "20+ premium" },
        { feature: "Custom branding", free: false, pro: true },
        { feature: "Advanced animations", free: false, pro: true },
        { feature: "Font customization", free: false, pro: true },
      ]
    },
    {
      category: "Analytics & Support",
      items: [
        { feature: "Advanced analytics", free: false, pro: true },
        { feature: "Priority support", free: false, pro: true },
        { feature: "API access", free: false, pro: true },
        { feature: "Custom integrations", free: false, pro: true },
      ]
    }
  ];

  const testimonials = [
    {
      name: "StreamerPro",
      viewers: "2.5K",
      quote: "BanterBox Pro transformed my stream! The ElevenLabs voices are incredible and my chat engagement went up 200%.",
      rating: 5
    },
    {
      name: "GamingQueen",
      viewers: "1.8K", 
      quote: "The unlimited generation is a game-changer. No more worrying about daily limits during long streams.",
      rating: 5
    },
    {
      name: "TechTalker",
      viewers: "950",
      quote: "Custom voice cloning with my own voice? Mind blown. My audience loves the personalized responses.",
      rating: 5
    }
  ];

  const handleUpgrade = () => {
    // TODO: Implement Stripe checkout
    console.log('Upgrading to Pro');
  };

  // Check if user is already Pro
  const isAlreadyPro = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'byok' || user?.subscriptionTier === 'enterprise';

  if (isAlreadyPro) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-dark to-dark-lighter">
        <div className="container mx-auto px-4 py-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white">
                You're already a Pro!
              </h1>
              <p className="text-xl text-gray-300">
                Thanks for supporting BanterBox. You have access to all premium features.
              </p>
            </div>

            <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-lg p-6 border border-yellow-500/30">
              <h3 className="text-lg font-semibold text-yellow-400 mb-3">Pro Features Active</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center text-green-400">
                  <Check className="w-4 h-4 mr-2" />
                  Unlimited banters
                </div>
                <div className="flex items-center text-green-400">
                  <Check className="w-4 h-4 mr-2" />
                  ElevenLabs voices
                </div>
                <div className="flex items-center text-green-400">
                  <Check className="w-4 h-4 mr-2" />
                  Premium themes
                </div>
                <div className="flex items-center text-green-400">
                  <Check className="w-4 h-4 mr-2" />
                  Priority support
                </div>
              </div>
            </div>

            <Link href="/dashboard">
              <Button size="lg" className="bg-primary hover:bg-primary/80">
                Continue to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark to-dark-lighter">
      <div className="container mx-auto px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Hero Section */}
        <div className="text-center space-y-6 mb-12">
          <div className="space-y-4">
            <Badge className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-2">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Badge>
            <h1 className="text-5xl font-bold text-white">
              Unlock Premium
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {" "}Features
              </span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Take your streaming to the next level with unlimited banters, premium voices, and advanced customization options.
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex justify-center mb-8">
            <div className="bg-gray-800/50 rounded-lg p-1 border border-gray-700">
              <Button
                variant={!isYearly ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsYearly(false)}
                className="px-6"
              >
                Monthly
              </Button>
              <Button
                variant={isYearly ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsYearly(true)}
                className="px-6 relative"
              >
                Yearly
                <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5">
                  Save {savings}%
                </Badge>
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan */}
            <Card className="bg-dark-lighter/50 border-gray-700">
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl text-white">Free</CardTitle>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-white">$0</div>
                  <p className="text-gray-400">Perfect for getting started</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center text-green-400">
                    <Check className="w-4 h-4 mr-3" />
                    <span className="text-sm">50 banters per day</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Check className="w-4 h-4 mr-3" />
                    <span className="text-sm">OpenAI TTS voices</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Check className="w-4 h-4 mr-3" />
                    <span className="text-sm">Basic overlay themes</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Check className="w-4 h-4 mr-3" />
                    <span className="text-sm">Twitch integration</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <X className="w-4 h-4 mr-3" />
                    <span className="text-sm">Premium voices</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <X className="w-4 h-4 mr-3" />
                    <span className="text-sm">Unlimited generation</span>
                  </div>
                </div>
                <Button className="w-full" variant="outline" disabled>
                  Current Plan
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-gradient-to-b from-primary/10 to-secondary/10 border-primary/50 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-primary to-secondary text-white px-4 py-1">
                  Most Popular
                </Badge>
              </div>
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl text-white flex items-center justify-center">
                  <Crown className="w-6 h-6 mr-2 text-yellow-400" />
                  Pro
                </CardTitle>
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-white">
                    ${isYearly ? yearlyMonthlyEquivalent.toFixed(2) : monthlyPrice}
                    <span className="text-lg text-gray-400">/month</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-green-400">
                      Billed yearly (${yearlyPrice}/year)
                    </p>
                  )}
                  <p className="text-gray-400">For serious streamers</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center text-green-400">
                    <Infinity className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">Unlimited banters</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Mic className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">ElevenLabs premium voices</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Palette className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">20+ premium themes</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Zap className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">Priority generation</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Users className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">Advanced analytics</span>
                  </div>
                  <div className="flex items-center text-green-400">
                    <Clock className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">Priority support</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                  onClick={handleUpgrade}
                >
                  Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Feature Comparison */}
        <div className="max-w-6xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Feature Comparison
          </h2>
          <div className="space-y-8">
            {features.map((category) => (
              <Card key={category.category} className="bg-dark-lighter/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-white">{category.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {category.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-3 gap-4 items-center py-2 border-b border-gray-700 last:border-b-0">
                        <div className="text-gray-300">{item.feature}</div>
                        <div className="text-center">
                          {typeof item.free === 'boolean' ? (
                            item.free ? (
                              <Check className="w-4 h-4 text-green-400 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-gray-500 mx-auto" />
                            )
                          ) : (
                            <span className="text-sm text-gray-400">{item.free}</span>
                          )}
                        </div>
                        <div className="text-center">
                          {typeof item.pro === 'boolean' ? (
                            item.pro ? (
                              <Check className="w-4 h-4 text-green-400 mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-gray-500 mx-auto" />
                            )
                          ) : (
                            <span className="text-sm text-primary font-medium">{item.pro}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            What Streamers Say
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-dark-lighter/50 border-gray-700">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 text-sm italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{testimonial.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {testimonial.viewers} viewers
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold text-white">
            Ready to level up your stream?
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Join thousands of streamers who are already using BanterBox Pro to create more engaging content and grow their audience.
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 px-8 py-3"
            onClick={handleUpgrade}
          >
            <Crown className="w-5 h-5 mr-2" />
            Upgrade to Pro Now
          </Button>
        </div>
      </div>
    </div>
  );
}