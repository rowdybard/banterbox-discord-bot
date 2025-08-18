import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Store, 
  Download, 
  Heart, 
  Search,
  Filter,
  Brain,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  Star,
  Play,
  Loader2
} from "lucide-react";

const PERSONALITY_CATEGORIES = [
  'All Categories', 'Gaming', 'Music', 'Comedy', 'Education', 'Custom', 'Entertainment', 'Professional'
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'downloads', label: 'Most Downloaded' },
  { value: 'highest-rated', label: 'Highest Rated' }
];

const TEST_SCENARIOS = [
  "A new viewer joins the stream",
  "Someone subscribes to the channel", 
  "A donation comes in with a funny message",
  "Chat is being toxic to another viewer",
  "Streamer achieves something impressive in-game",
  "Someone asks for gaming advice",
  "Chat gets excited about a clutch play"
];

interface Personality {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  tags: string[];
  authorName: string;
  isVerified: boolean;
  downloads: number;
  upvotes: number;
  downvotes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('popular');
  const [testScenario, setTestScenario] = useState(TEST_SCENARIOS[0]);
  const [testResult, setTestResult] = useState<string>('');
  const [testPersonalityId, setTestPersonalityId] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personalities = [], isLoading } = useQuery({
    queryKey: ['/api/marketplace/personalities'],
  });

  const typedPersonalities = personalities as Personality[];
  const filteredPersonalities = typedPersonalities.filter((personality: Personality) => {
    const matchesSearch = personality.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         personality.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         personality.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All Categories' || personality.category === selectedCategory;
    
    return matchesSearch && matchesCategory && personality.isActive;
  });

  const sortedPersonalities = [...filteredPersonalities].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'downloads':
        return b.downloads - a.downloads;
      case 'highest-rated':
        return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
      case 'popular':
      default:
        return (b.upvotes + b.downloads) - (a.upvotes + a.downloads);
    }
  });

  const testPersonalityMutation = useMutation({
    mutationFn: async ({ personality, scenario }: { personality: Personality, scenario: string }) => {
      const response = await apiRequest('POST', '/api/personality/test', {
        prompt: personality.prompt,
        message: scenario
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data.banterText);
    },
    onError: () => {
      toast({
        title: "Test Failed",
        description: "Could not test personality. Try again.",
        variant: "destructive",
      });
    }
  });

  const handleTestPersonality = (personality: Personality) => {
    setTestPersonalityId(personality.id);
    testPersonalityMutation.mutate({ personality, scenario: testScenario });
  };

  const downloadMutation = useMutation({
    mutationFn: async (personalityId: string) => {
      const response = await apiRequest('POST', `/api/marketplace/personalities/${personalityId}/download`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Personality Downloaded!",
        description: `"${data.personalityName}" has been added to your library and is now available in your dashboard.`,
      });
      // Invalidate queries to refresh the dashboard options
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/personalities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Could not download personality. Please try again.";
      toast({
        title: "Download Failed",
        description: message,
        variant: "destructive",
      });
    }
  });

  const handleDownload = (personality: Personality) => {
    downloadMutation.mutate(personality.id);
  };

  const getRating = (upvotes: number, downvotes: number) => {
    const total = upvotes + downvotes;
    if (total === 0) return 0;
    return Math.round((upvotes / total) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                AI Personality Marketplace
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Discover and download AI personalities created by the community
              </p>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/voice-marketplace'}
                  className="text-xs"
                >
                  <Users className="h-3 w-3 mr-1" />
                  Voice Marketplace
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search personalities, descriptions, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48" data-testid="category-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {PERSONALITY_CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48" data-testid="sort-select">
                <TrendingUp className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {sortedPersonalities.length} of {typedPersonalities.length} personalities
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Personalities Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedPersonalities.map((personality: Personality) => (
              <Card key={personality.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Brain className="h-5 w-5 text-purple-600" />
                        {personality.name}
                        {personality.isVerified && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Users className="h-3 w-3" />
                        by {personality.authorName}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {personality.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                    {personality.description}
                  </p>
                  
                  {/* Tags */}
                  {personality.tags && personality.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {personality.tags.slice(0, 3).map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {personality.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{personality.tags.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {personality.downloads.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {getRating(personality.upvotes, personality.downvotes)}%
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(personality.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full"
                          data-testid={`test-personality-${personality.id}`}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Test Personality
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Brain className="h-5 w-5" />
                            Test "{personality.name}"
                          </DialogTitle>
                          <DialogDescription>
                            See how this personality responds to different stream scenarios
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Test Scenario</label>
                            <Select value={testScenario} onValueChange={setTestScenario}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TEST_SCENARIOS.map((scenario, index) => (
                                  <SelectItem key={index} value={scenario}>
                                    {scenario}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button
                            onClick={() => handleTestPersonality(personality)}
                            disabled={testPersonalityMutation.isPending && testPersonalityId === personality.id}
                            className="w-full"
                          >
                            {testPersonalityMutation.isPending && testPersonalityId === personality.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4 mr-2" />
                            )}
                            {testPersonalityMutation.isPending && testPersonalityId === personality.id ? "Testing..." : "Test Response"}
                          </Button>
                          
                          {testResult && testPersonalityId === personality.id && (
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border">
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Response:</label>
                              <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">{testResult}</p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      onClick={() => handleDownload(personality)}
                      className="w-full"
                      data-testid={`download-personality-${personality.id}`}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Personality
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && sortedPersonalities.length === 0 && (
          <div className="text-center py-12">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No personalities found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery || selectedCategory !== 'All Categories'
                ? "Try adjusting your search or filters"
                : "Be the first to create and share a personality!"}
            </p>
            <Button onClick={() => window.location.href = '/personality-builder'}>
              <Brain className="h-4 w-4 mr-2" />
              Create Your First Personality
            </Button>
          </div>
        )}

        {/* Call to Action */}
        {!isLoading && sortedPersonalities.length > 0 && (
          <div className="mt-12 text-center">
            <Card className="max-w-2xl mx-auto bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-700">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500">
                    <Star className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Create Your Own Personality
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Share your unique AI personality with the community and help other streamers find their perfect companion.
                    </p>
                  </div>
                  <Button 
                    onClick={() => window.location.href = '/personality-builder'}
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    data-testid="create-personality-button"
                  >
                    <Brain className="h-5 w-5 mr-2" />
                    Build a Personality
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}