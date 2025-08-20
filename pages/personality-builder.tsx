import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Brain, 
  Save, 
  Upload,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  MessageSquare,
  Shield
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const PERSONALITY_CATEGORIES = [
  'Gaming', 'Streaming', 'Comedy', 'Education', 'Music', 'Custom', 'Entertainment', 'Professional'
];

const PERSONALITY_TAGS = [
  'witty', 'sarcastic', 'friendly', 'professional', 'hype', 'chill', 'educational', 
  'entertaining', 'supportive', 'roast', 'motivational', 'analytical', 'creative', 'dramatic'
];

const SAMPLE_SCENARIOS = [
  "A new viewer joins the stream",
  "Someone subscribes to the channel", 
  "A donation comes in with a funny message",
  "Chat is being toxic to another viewer",
  "Streamer achieves something impressive in-game"
];

// Simple content moderation using keyword filtering
const FLAGGED_CONTENT = {
  harmful: ['suicide', 'kill yourself', 'end your life', 'hurt yourself', 'self harm', 'self-harm'],
  sexual: ['sexual', 'nsfw', 'explicit', 'adult content', 'porn', 'sex'],
  harassment: ['hate', 'racist', 'sexist', 'bully', 'harass', 'nazi', 'fascist'],
  inappropriate: ['illegal', 'drugs', 'violence against', 'harm others', 'murder', 'terrorist']
};

function moderateContent(text: string): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const lowerText = text.toLowerCase();
  
  Object.entries(FLAGGED_CONTENT).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        issues.push(`Contains ${category} content: "${keyword}"`);
      }
    });
  });
  
  return { passed: issues.length === 0, issues };
}

export default function PersonalityBuilderPage() {
  const [personalityName, setPersonalityName] = useState('');
  const [personalityDescription, setPersonalityDescription] = useState('');
  const [personalityPrompt, setPersonalityPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Custom');
  const [selectedTags, setSelectedTags] = useState<string[]>(['custom']);
  const [addToMarketplace, setAddToMarketplace] = useState(false);
  const [testScenario, setTestScenario] = useState(SAMPLE_SCENARIOS[0]);
  const [testResult, setTestResult] = useState<string>('');
  const [moderationResult, setModerationResult] = useState<{ passed: boolean; issues: string[] } | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if user has Pro subscription
  const isPro = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'byok' || user?.subscriptionTier === 'enterprise';

  if (!isPro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <CardTitle className="text-2xl font-bold mb-2">Pro Subscription Required</CardTitle>
          <CardDescription className="mb-4 text-gray-600 dark:text-gray-400">
            Personality Builder requires a Pro subscription to create custom personalities.
            Upgrade to unlock advanced AI personality creation.
          </CardDescription>
          <Link href="/pricing">
            <Button className="w-full">Upgrade Now</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const testPersonalityMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/personality/test', {
        personality: 'custom',
        prompt: personalityPrompt,
        message: testScenario
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          throw new Error(`Subscription required: ${errorData.message}`);
        }
        throw new Error(`Test failed: ${errorData.message || response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data.banterText);
    },
    onError: (error: any) => {
      if (error.message.includes('Subscription required')) {
        toast({
          title: "Pro Subscription Required",
          description: "Personality Builder requires a Pro subscription. Upgrade to create custom personalities!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test Failed",
          description: error.message || "Could not test personality. Try again.",
          variant: "destructive",
        });
      }
    }
  });

  const savePersonalityMutation = useMutation({
    mutationFn: async () => {
      // Ensure we have all required data
      const personalityData = {
        name: personalityName.trim(),
        description: personalityDescription.trim(),
        prompt: personalityPrompt.trim(), // Ensure prompt is included
        category: selectedCategory,
        tags: selectedTags.length > 0 ? selectedTags : ['custom'],
        addToMarketplace: addToMarketplace // Send the marketplace flag
      };

      console.log('Saving personality with data:', personalityData); // Debug log

      const response = await apiRequest('POST', '/api/personality-builder/save', personalityData);
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          throw new Error(`Subscription required: ${errorData.message}`);
        }
        throw new Error(`Save failed: ${errorData.message || response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: addToMarketplace ? "Personality Saved & Added to Marketplace!" : "Personality Saved!",
        description: addToMarketplace 
          ? `Custom personality "${personalityName}" has been saved and added to the marketplace!`
          : `Custom personality "${personalityName}" has been saved to your library.`,
      });
      
      // Reset form
      setPersonalityName('');
      setPersonalityDescription('');
      setPersonalityPrompt('');
      setSelectedCategory('Custom');
      setSelectedTags(['custom']);
      setAddToMarketplace(false);
      setModerationResult(null);
      setTestResult('');
    },
    onError: (error: any) => {
      console.error('Save personality error:', error); // Debug log
      if (error.message.includes('Subscription required')) {
        toast({
          title: "Pro Subscription Required",
          description: "Personality Builder requires a Pro subscription. Upgrade to create custom personalities!",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Save Failed",
          description: error.message || "Could not save personality. Try again.",
          variant: "destructive",
        });
      }
    }
  });

  const handleSavePersonality = () => {
    // Clear previous moderation results
    setModerationResult(null);
    
    if (!personalityName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your personality.",
        variant: "destructive",
      });
      return;
    }
    
    if (!personalityPrompt.trim()) {
      toast({
        title: "Personality Prompt Required",
        description: "Please describe how this AI personality should behave.",
        variant: "destructive",
      });
      return;
    }

    if (addToMarketplace && !personalityDescription.trim()) {
      toast({
        title: "Description Required",
        description: "Please add a description when adding to marketplace.",
        variant: "destructive",
      });
      return;
    }

    // Content moderation check
    const fullText = `${personalityName} ${personalityDescription} ${personalityPrompt}`;
    const moderation = moderateContent(fullText);
    setModerationResult(moderation);
    
    if (!moderation.passed) {
      toast({
        title: "Content Moderation Failed",
        description: "Your personality contains inappropriate content. Please review and modify.",
        variant: "destructive",
      });
      return;
    }

    if (addToMarketplace && selectedTags.length === 0) {
      toast({
        title: "Tags Required",
        description: "Please select at least one tag for marketplace personalities.",
        variant: "destructive",
      });
      return;
    }
    
    console.log('Submitting personality with prompt:', personalityPrompt); // Debug log
    savePersonalityMutation.mutate();
  };

  const handleTestPersonality = () => {
    if (!personalityPrompt.trim()) {
      toast({
        title: "Personality Prompt Required",
        description: "Please describe the personality behavior first.",
        variant: "destructive",
      });
      return;
    }
    
    testPersonalityMutation.mutate();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Personality Builder
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Create custom AI personalities that define how your bot responds
              </p>
            </div>
          </div>
        </div>

        {/* Content Guidelines */}
        <Alert className="mb-8 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Content Guidelines:</strong> Personalities can be witty, sarcastic, or even mean, but must remain ethical. 
            No content promoting self-harm, explicit material, harassment, or illegal activities will be accepted.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Personality Setup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Personality Setup
              </CardTitle>
              <CardDescription>
                Define how your AI personality should behave and respond
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="personality-name" className="text-sm font-medium">Personality Name</Label>
                <Input
                  id="personality-name"
                  placeholder="e.g. Sarcastic Gaming Buddy, Supportive Coach"
                  value={personalityName}
                  onChange={(e) => setPersonalityName(e.target.value)}
                  data-testid="personality-name-input"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="personality-prompt" className="text-sm font-medium">
                  Personality Behavior Description
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Textarea
                  id="personality-prompt"
                  placeholder="Describe how this personality should respond to chat messages, donations, subscriptions, etc. Be specific about tone, style, and behavior. Example: 'You are a witty gaming companion who makes clever jokes about gameplay, roasts bad plays playfully, and celebrates victories with enthusiasm. Keep responses short and punchy.'"
                  value={personalityPrompt}
                  onChange={(e) => setPersonalityPrompt(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="personality-prompt-input"
                />
                <p className="text-xs text-gray-500">
                  Be specific about tone, response style, and behavior patterns. This controls how the AI will react.
                </p>
              </div>

              {addToMarketplace && (
                <>
                  <div className="space-y-3">
                    <Label htmlFor="personality-description" className="text-sm font-medium">
                      Public Description
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Textarea
                      id="personality-description"
                      placeholder="A brief description for other users to understand this personality"
                      value={personalityDescription}
                      onChange={(e) => setPersonalityDescription(e.target.value)}
                      data-testid="personality-description-input"
                      className={addToMarketplace && !personalityDescription.trim() ? "border-red-300 focus:border-red-500" : ""}
                    />
                    {addToMarketplace && !personalityDescription.trim() && (
                      <p className="text-xs text-red-500">Description is required for marketplace personalities</p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger data-testid="category-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSONALITY_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Tags ({selectedTags.length} selected)
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PERSONALITY_TAGS.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                            selectedTags.includes(tag)
                              ? 'bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700'
                          }`}
                          data-testid={`tag-${tag}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    {addToMarketplace && selectedTags.length === 0 && (
                      <p className="text-xs text-red-500">At least one tag is required for marketplace personalities</p>
                    )}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-700">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                    <Upload className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Add to Marketplace</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Share your personality with the community (subject to moderation)</p>
                  </div>
                </div>
                <Button
                  variant={addToMarketplace ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAddToMarketplace(!addToMarketplace)}
                  data-testid="marketplace-toggle-button"
                  className={addToMarketplace ? "bg-purple-600 hover:bg-purple-700" : ""}
                >
                  {addToMarketplace ? "ENABLED" : "DISABLED"}
                </Button>
              </div>

              {/* Moderation Results */}
              {moderationResult && (
                <Alert className={moderationResult.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                  {moderationResult.passed ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    {moderationResult.passed ? (
                      "Content passed moderation review ✓"
                    ) : (
                      <div>
                        <strong>Content moderation issues:</strong>
                        <ul className="mt-1 list-disc list-inside text-sm">
                          {moderationResult.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSavePersonality}
                disabled={savePersonalityMutation.isPending || !personalityName.trim() || !personalityPrompt.trim()}
                className={`w-full flex items-center gap-2 h-12 text-base font-medium ${
                  addToMarketplace 
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" 
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
                data-testid="save-personality-button"
              >
                <Save className="h-5 w-5" />
                {savePersonalityMutation.isPending 
                  ? "Saving..." 
                  : addToMarketplace 
                    ? "Save & Add to Marketplace" 
                    : "Save Personality"
                }
              </Button>
              
              {addToMarketplace && (
                <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-2">
                  Your personality will be immediately available in the marketplace
                </p>
              )}
            </CardContent>
          </Card>

          {/* Test & Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Test Personality
              </CardTitle>
              <CardDescription>
                See how your personality responds to different scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Test Scenario</Label>
                <Select value={testScenario} onValueChange={setTestScenario}>
                  <SelectTrigger data-testid="test-scenario-select">
                    <SelectValue placeholder="Choose a scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_SCENARIOS.map((scenario, index) => (
                      <SelectItem key={index} value={scenario}>
                        {scenario}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleTestPersonality}
                disabled={testPersonalityMutation.isPending || !personalityPrompt.trim()}
                className="w-full"
                data-testid="test-personality-button"
              >
                {testPersonalityMutation.isPending ? "Testing..." : "Test Response"}
              </Button>

              {testResult && (
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Response:</Label>
                  <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">{testResult}</p>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Guidelines for Ethical Personalities</h3>
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Can be sarcastic, witty, or even mean in a playful way</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Can roast gameplay, make jokes, or be competitive</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No content promoting self-harm or harmful activities</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No explicit sexual content or harassment</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>No hate speech or targeted harassment</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}