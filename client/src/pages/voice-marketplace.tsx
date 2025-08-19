import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  Download, 
  Play, 
  Square,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Mic,
  Flag
} from "lucide-react";
import { RatingButtons } from "@/components/marketplace/rating-buttons";
import { ReportDialog } from "@/components/marketplace/report-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

const VOICE_CATEGORIES = [
  'all', 'Gaming', 'Streaming', 'Comedy', 'Education', 'Music', 'Custom', 'Entertainment', 'Professional'
];

interface MarketplaceVoice {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  baseVoiceId: string;
  settings: any;
  sampleText: string;
  downloads: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  authorId: string;
}

export default function VoiceMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'downloads'>('recent');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportItem, setReportItem] = useState<{ id: string; name: string } | null>(null);

  const { toast } = useToast();

  const { data: voices = [], isLoading } = useQuery({
    queryKey: ['/api/marketplace/voices', selectedCategory, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      params.append('sortBy', sortBy);
      params.append('limit', '20');
      
      const response = await fetch(`/api/marketplace/voices?${params}`);
      if (!response.ok) throw new Error('Failed to fetch voices');
      return response.json();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const response = await apiRequest('POST', `/api/marketplace/voices/${voiceId}/download`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Voice Downloaded!",
        description: `"${data.voiceName}" has been added to your library and is now available in your dashboard.`,
      });
      // Invalidate queries to refresh the dashboard options
      queryClient.invalidateQueries({ queryKey: ['/api/favorites/voices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
    onError: () => {
      toast({
        title: "Download Failed",
        description: "Could not download voice. Please try again.",
        variant: "destructive",
      });
    }
  });

  const previewMutation = useMutation({
    mutationFn: async (voice: MarketplaceVoice) => {
      const response = await fetch('/api/voice-builder/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voice.sampleText,
          baseVoiceId: voice.baseVoiceId,
          settings: typeof voice.settings === 'string' ? JSON.parse(voice.settings) : voice.settings
        })
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status}`);
      }

      return response.blob();
    },
    onSuccess: async (audioBlob, voice) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      
      audio.onended = () => {
        setPlayingVoice(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingVoice(null);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Preview Error",
          description: "Could not play voice preview",
          variant: "destructive",
        });
      };

      setPlayingVoice(voice.id);
      await audio.play();
    },
    onError: () => {
      toast({
        title: "Preview Failed",
        description: "Could not generate voice preview.",
        variant: "destructive",
      });
    }
  });

  const handlePlayPreview = (voice: MarketplaceVoice) => {
    if (playingVoice === voice.id) {
      currentAudio?.pause();
      setPlayingVoice(null);
      return;
    }
    previewMutation.mutate(voice);
  };

  const handleDownload = (voiceId: string) => {
    downloadMutation.mutate(voiceId);
  };

  const filteredVoices = voices.filter((voice: MarketplaceVoice) => {
    if (!searchQuery) return true;
    return voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           voice.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
           voice.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-dark-lighter to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Voice Marketplace
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Discover and download community-created voices
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search voices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-voices-input"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="category-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: 'recent' | 'popular' | 'downloads') => setSortBy(value)}>
                <SelectTrigger data-testid="sort-filter">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="downloads">Most Downloaded</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-sm text-gray-500 flex items-center">
                {filteredVoices.length} voices found
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVoices.map((voice: MarketplaceVoice) => (
              <Card key={voice.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        {voice.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {voice.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {voice.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1">
                    {voice.tags?.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {voice.downloads}
                      </span>
                      <RatingButtons
                        itemType="voice"
                        itemId={voice.id}
                        upvotes={voice.upvotes}
                        downvotes={voice.downvotes}
                        size="sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReportItem({ id: voice.id, name: voice.name });
                        setReportDialogOpen(true);
                      }}
                    >
                      <Flag className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlayPreview(voice)}
                      disabled={previewMutation.isPending}
                      className="flex-1"
                      data-testid={`preview-voice-${voice.id}`}
                    >
                      {playingVoice === voice.id ? (
                        <Square className="h-3 w-3 mr-1" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      {previewMutation.isPending && previewMutation.variables?.id === voice.id ? "Loading..." : playingVoice === voice.id ? "Stop" : "Preview"}
                    </Button>
                    
                    <Button
                      size="sm"
                      onClick={() => handleDownload(voice.id)}
                      disabled={downloadMutation.isPending}
                      className="flex-1"
                      data-testid={`download-voice-${voice.id}`}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      {downloadMutation.isPending && downloadMutation.variables === voice.id ? "Downloading..." : "Download"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredVoices.length === 0 && !isLoading && (
          <Card className="text-center py-12">
            <CardContent>
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No voices found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'Try adjusting your search terms or filters.' : 'Be the first to share a voice!'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Report Dialog */}
      {reportItem && (
        <ReportDialog
          open={reportDialogOpen}
          onOpenChange={setReportDialogOpen}
          itemType="voice"
          itemId={reportItem.id}
          itemName={reportItem.name}
        />
      )}
    </div>
  );
}