import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Wand2, 
  Play, 
  Square, 
  Save, 
  Mic, 
  Volume2, 
  Settings, 
  Sparkles,
  Download,
  Upload,
  RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VoiceSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

interface BaseVoice {
  id: string;
  name: string;
  description: string;
  category: string;
  gender: string;
  accent: string;
}

const BASE_VOICES: BaseVoice[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'American Female', category: 'Narration', gender: 'Female', accent: 'American' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong American Female', category: 'Narration', gender: 'Female', accent: 'American' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', description: 'American Female', category: 'Narration', gender: 'Female', accent: 'American' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Well-rounded American Male', category: 'Narration', gender: 'Male', accent: 'American' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp American Male', category: 'Narration', gender: 'Male', accent: 'American' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep American Male', category: 'Narration', gender: 'Male', accent: 'American' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Raspy American Male', category: 'Narration', gender: 'Male', accent: 'American' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Casual British Male', category: 'Conversational', gender: 'Male', accent: 'British' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Warm British Male', category: 'Narration', gender: 'Male', accent: 'British' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Seductive Female', category: 'Social Media', gender: 'Female', accent: 'English' },
];

const SAMPLE_TEXTS = [
  "Welcome to the stream! Thanks for joining us tonight.",
  "That was an incredible play! The timing was absolutely perfect.",
  "Don't forget to follow and subscribe for more amazing content.",
  "This donation just made my day - thank you so much for the support!",
  "Let's see what happens next in this epic gaming session."
];

const VOICE_CATEGORIES = [
  'Gaming', 'Streaming', 'Comedy', 'Education', 'Music', 'Custom', 'Entertainment', 'Professional'
];

const SUGGESTED_TAGS = [
  'energetic', 'calm', 'funny', 'professional', 'gaming', 'streaming', 'educational', 
  'music', 'entertainment', 'expressive', 'smooth', 'dynamic', 'friendly', 'dramatic'
];

export default function VoiceBuilderPage() {
  const [selectedBaseVoice, setSelectedBaseVoice] = useState<string>('21m00Tcm4TlvDq8ikWAM');
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Custom');
  const [selectedTags, setSelectedTags] = useState<string[]>(['custom']);
  const [addToMarketplace, setAddToMarketplace] = useState(false);
  const [sampleText, setSampleText] = useState(SAMPLE_TEXTS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    stability: 50,
    similarityBoost: 75,
    style: 0,
    useSpeakerBoost: true
  });

  const { toast } = useToast();

  const selectedVoice = BASE_VOICES.find(v => v.id === selectedBaseVoice);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/voice-builder/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          baseVoiceId: selectedBaseVoice,
          settings: voiceSettings
        })
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status}`);
      }

      return response.blob();
    },
    onSuccess: async (audioBlob) => {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Audio Error",
          description: "Could not play voice preview",
          variant: "destructive",
        });
      };

      setIsPlaying(true);
      await audio.play();
    },
    onError: (error) => {
      toast({
        title: "Preview Failed",
        description: "Could not generate voice preview. Try again.",
        variant: "destructive",
      });
    }
  });

  const saveVoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/voice-builder/save', {
        name: voiceName,
        description: voiceDescription,
        category: selectedCategory,
        tags: selectedTags,
        baseVoiceId: selectedBaseVoice,
        settings: voiceSettings,
        addToMarketplace: addToMarketplace,
        sampleText: sampleText
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: addToMarketplace ? "Voice Saved & Added to Marketplace!" : "Voice Saved!",
        description: addToMarketplace 
          ? `Custom voice "${voiceName}" has been saved and added to the marketplace for others to discover.`
          : `Custom voice "${voiceName}" has been saved to your library.`,
      });
      setVoiceName('');
      setVoiceDescription('');
      setSelectedCategory('Custom');
      setSelectedTags(['custom']);
      setAddToMarketplace(false);
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Could not save custom voice. Try again.",
        variant: "destructive",
      });
    }
  });

  const handlePlayPreview = () => {
    if (isPlaying) {
      currentAudio?.pause();
      setIsPlaying(false);
      return;
    }
    previewMutation.mutate();
  };

  const handleSaveVoice = () => {
    if (!voiceName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your custom voice.",
        variant: "destructive",
      });
      return;
    }
    if (addToMarketplace && !voiceDescription.trim()) {
      toast({
        title: "Description Required",
        description: "Please add a description when adding to marketplace.",
        variant: "destructive",
      });
      return;
    }
    if (addToMarketplace && selectedTags.length === 0) {
      toast({
        title: "Tags Required",
        description: "Please select at least one tag for marketplace voices.",
        variant: "destructive",
      });
      return;
    }
    saveVoiceMutation.mutate();
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const resetSettings = () => {
    setVoiceSettings({
      stability: 50,
      similarityBoost: 75,
      style: 0,
      useSpeakerBoost: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
              <Wand2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Voice Builder
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Create custom voices with ElevenLabs AI technology
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Base Voice Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Base Voice
              </CardTitle>
              <CardDescription>
                Choose a foundation voice to customize
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedBaseVoice} onValueChange={setSelectedBaseVoice}>
                <SelectTrigger data-testid="base-voice-select">
                  <SelectValue placeholder="Select base voice" />
                </SelectTrigger>
                <SelectContent>
                  {BASE_VOICES.map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{voice.name}</span>
                        <span className="text-sm text-gray-500">{voice.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedVoice && (
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedVoice.name}</span>
                    <Badge variant="secondary">{selectedVoice.gender}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedVoice.description}
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedVoice.accent}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedVoice.category}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voice Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Voice Customization
              </CardTitle>
              <CardDescription>
                Fine-tune voice characteristics with advanced controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="settings" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="settings">Voice Settings</TabsTrigger>
                  <TabsTrigger value="preview">Preview & Test</TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Stability</Label>
                        <p className="text-xs text-gray-500 mb-3">
                          Higher values make voice more consistent but less expressive
                        </p>
                        <Slider
                          value={[voiceSettings.stability]}
                          onValueChange={(value) => setVoiceSettings({...voiceSettings, stability: value[0]})}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <span>More Creative</span>
                          <span className="font-medium">{voiceSettings.stability}%</span>
                          <span>More Stable</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Similarity Boost</Label>
                        <p className="text-xs text-gray-500 mb-3">
                          Enhances similarity to the original voice
                        </p>
                        <Slider
                          value={[voiceSettings.similarityBoost]}
                          onValueChange={(value) => setVoiceSettings({...voiceSettings, similarityBoost: value[0]})}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <span>Less Similar</span>
                          <span className="font-medium">{voiceSettings.similarityBoost}%</span>
                          <span>More Similar</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Style Exaggeration</Label>
                        <p className="text-xs text-gray-500 mb-3">
                          Higher values make the voice more expressive
                        </p>
                        <Slider
                          value={[voiceSettings.style]}
                          onValueChange={(value) => setVoiceSettings({...voiceSettings, style: value[0]})}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                          <span>More Natural</span>
                          <span className="font-medium">{voiceSettings.style}%</span>
                          <span>More Expressive</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Advanced Options</Label>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <div>
                            <span className="text-sm font-medium">Speaker Boost</span>
                            <p className="text-xs text-gray-500">Enhances voice clarity</p>
                          </div>
                          <Button
                            variant={voiceSettings.useSpeakerBoost ? "default" : "outline"}
                            size="sm"
                            onClick={() => setVoiceSettings({
                              ...voiceSettings, 
                              useSpeakerBoost: !voiceSettings.useSpeakerBoost
                            })}
                          >
                            {voiceSettings.useSpeakerBoost ? "ON" : "OFF"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={resetSettings} variant="outline" className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Reset to Defaults
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-6">
                  <div>
                    <Label htmlFor="sample-text" className="text-sm font-medium">Preview Text</Label>
                    <Select value={sampleText} onValueChange={setSampleText}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Choose sample text" />
                      </SelectTrigger>
                      <SelectContent>
                        {SAMPLE_TEXTS.map((text, index) => (
                          <SelectItem key={index} value={text}>
                            {text}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handlePlayPreview}
                      disabled={previewMutation.isPending}
                      className="flex items-center gap-2"
                      data-testid="preview-voice-button"
                    >
                      {isPlaying ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {previewMutation.isPending ? "Generating..." : isPlaying ? "Stop" : "Preview Voice"}
                    </Button>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <Label className="text-sm font-medium">Save Custom Voice</Label>
                    
                    <div className="space-y-3">
                      <Input
                        id="voice-name"
                        placeholder="Enter voice name (e.g. My Gaming Voice)"
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        data-testid="voice-name-input"
                      />
                      
                      {addToMarketplace && (
                        <>
                          <Input
                            id="voice-description"
                            placeholder="Describe this voice for the marketplace (e.g. Perfect for gaming streams with energetic tone)"
                            value={voiceDescription}
                            onChange={(e) => setVoiceDescription(e.target.value)}
                            data-testid="voice-description-input"
                          />
                          
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Category</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                              <SelectTrigger data-testid="category-select">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {VOICE_CATEGORIES.map(category => (
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
                            <p className="text-xs text-gray-500">
                              Select tags to help others discover your voice. At least one tag is required.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {SUGGESTED_TAGS.map(tag => (
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
                            {selectedTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-xs text-gray-500">Selected:</span>
                                {selectedTags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500">
                            <Upload className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <span className="text-sm font-medium">Add to Marketplace</span>
                            <p className="text-xs text-gray-500">Share your voice creation with the community</p>
                          </div>
                        </div>
                        <Button
                          variant={addToMarketplace ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAddToMarketplace(!addToMarketplace)}
                          data-testid="marketplace-toggle-button"
                        >
                          {addToMarketplace ? "ON" : "OFF"}
                        </Button>
                      </div>
                      
                      <Button
                        onClick={handleSaveVoice}
                        disabled={saveVoiceMutation.isPending || !voiceName.trim() || (addToMarketplace && !voiceDescription.trim())}
                        className="w-full flex items-center gap-2"
                        data-testid="save-voice-button"
                      >
                        <Save className="h-4 w-4" />
                        {saveVoiceMutation.isPending ? "Saving..." : addToMarketplace ? "Save & Add to Marketplace" : "Save Voice"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">AI-Powered</h3>
                  <p className="text-xs text-gray-500">Advanced neural networks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <Volume2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">High Quality</h3>
                  <p className="text-xs text-gray-500">Professional audio output</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Save className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Your Library</h3>
                  <p className="text-xs text-gray-500">Save unlimited voices</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}