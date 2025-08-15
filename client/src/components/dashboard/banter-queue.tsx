import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudio } from "../../hooks/use-audio";
import { useWebSocket } from "../../hooks/use-websocket";
import { formatDistanceToNow } from "date-fns";
import { Play, Edit, X, MessageSquare, Clock } from "lucide-react";
import type { BanterItem, EventData } from "@shared/schema";

interface BanterQueueProps {
  userId: string;
}

export default function BanterQueue({ userId }: BanterQueueProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { playAudio, isPlaying, currentAudioId } = useAudio();
  const { lastMessage } = useWebSocket();
  const [editText, setEditText] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEditingBanter, setCurrentEditingBanter] = useState<BanterItem | null>(null);


  // Get banter queue
  const { data: banters = [], isLoading, error } = useQuery({
    queryKey: ['/api/banter', userId],
    refetchInterval: 1000, // Refresh every second for real-time updates
    retry: 2,
    retryDelay: 1000,
  }) as { data: BanterItem[], isLoading: boolean, error: any };

  // Listen for WebSocket updates for real-time queue changes
  useEffect(() => {
    if (lastMessage) {
      const { type, data } = lastMessage;
      
      // Handle all banter-related events to update the queue immediately
      if (type === 'new_banter' || type === 'banter_played' || type === 'banter_replayed' || type === 'banter_updated' || type === 'banter_deleted') {
        console.log(`WebSocket: ${type} received for banter ${data?.id || 'unknown'}`);
        // Invalidate queries to trigger immediate refresh
        queryClient.invalidateQueries({ queryKey: ['/api/banter', userId] });
      }
    }
  }, [lastMessage, queryClient, userId]);

  // Play banter mutation
  const playBanterMutation = useMutation({
    mutationFn: async (banterId: string) => {
      const response = await apiRequest("POST", `/api/banter/${banterId}/play`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banter', userId] });
    },
  });



  // Delete banter mutation
  const deleteBanterMutation = useMutation({
    mutationFn: async (banterId: string) => {
      const response = await apiRequest("DELETE", `/api/banter/${banterId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banter', userId] });
      toast({
        title: "Banter deleted",
        description: "The banter has been removed from the queue.",
      });
    },
  });

  // Edit banter mutation
  const editBanterMutation = useMutation({
    mutationFn: async ({ id, banterText }: { id: string; banterText: string }) => {
      const response = await apiRequest("PUT", `/api/banter/${id}`, { banterText });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banter', userId] });
      handleCloseEdit();
      toast({
        title: "Banter updated",
        description: "The banter text has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update banter.",
        variant: "destructive",
      });
    },
  });

  const handlePlay = async (banter: BanterItem) => {
    try {
      if (banter.audioUrl) {
        // Get user settings for volume via API
        const response = await fetch(`/api/settings/${userId}`);
        const settings = await response.json();
        const audioVolume = (settings?.volume || 70) / 100;
        
        console.log('Playing banter audio:', banter.audioUrl, 'at volume:', audioVolume);
        await playAudio(banter.audioUrl, banter.id, audioVolume);
        playBanterMutation.mutate(banter.id);
      } else {
        toast({
          title: "Audio Error",
          description: "No audio file available.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      toast({
        title: "Playback Error",
        description: "Failed to play audio. Check console for details.",
        variant: "destructive",
      });
    }
  };



  const handleEdit = (banter: BanterItem) => {
    setCurrentEditingBanter(banter);
    setEditText(banter.banterText);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (currentEditingBanter && editText.trim()) {
      editBanterMutation.mutate({
        id: currentEditingBanter.id,
        banterText: editText.trim()
      });
    }
  };

  const handleCloseEdit = () => {
    setIsEditDialogOpen(false);
    setCurrentEditingBanter(null);
    setEditText("");
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'chat': return 'bg-primary/20 text-primary';
      case 'subscription': return 'bg-accent/20 text-accent';
      case 'donation': return 'bg-secondary/20 text-secondary';
      case 'raid': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Filter to only show unplayed banters
  const unplayedBanters = banters.filter(banter => !banter.isPlayed);

  const renderBanterItem = (banter: BanterItem) => (
    <div
      key={banter.id}
      className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-primary/50 transition-colors"
      data-testid={`card-banter-${banter.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <Badge className={`text-xs font-medium px-2 py-1 rounded ${getEventBadgeColor(banter.eventType)}`}>
              {banter.eventType.toUpperCase()}
            </Badge>
            {(banter.eventData as EventData)?.username && (
              <span className="text-xs text-gray-400">
                @{(banter.eventData as EventData).username}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(banter.createdAt!), { addSuffix: true })}
            </span>
          </div>
          
          {banter.originalMessage && (
            <p className="text-sm text-gray-300 mb-2">
              Original: "{banter.originalMessage}"
            </p>
          )}
          
          <p className="text-white font-medium" data-testid={`text-banter-${banter.id}`}>
            "{banter.banterText}"
          </p>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          <Button
            size="sm"
            onClick={() => handlePlay(banter)}
            disabled={!banter.audioUrl || (isPlaying && currentAudioId === banter.id)}
            className={`w-8 h-8 p-0 rounded-full transition-colors ${
              isPlaying && currentAudioId === banter.id
                ? 'bg-accent hover:bg-accent/80'
                : 'bg-primary hover:bg-primary/80'
            }`}
            data-testid={`button-play-${banter.id}`}
          >
            {isPlaying && currentAudioId === banter.id ? (
              <Clock className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(banter)}
            className="w-8 h-8 p-0 rounded-full bg-gray-700 hover:bg-gray-600"
            data-testid={`button-edit-${banter.id}`}
          >
            <Edit className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={() => deleteBanterMutation.mutate(banter.id)}
            disabled={deleteBanterMutation.isPending}
            className="w-8 h-8 p-0 rounded-full bg-red-600 hover:bg-red-700"
            data-testid={`button-delete-${banter.id}`}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardContent className="p-6">
          <ErrorDisplay 
            error={error}
            onRetry={() => queryClient.invalidateQueries({ queryKey: ['/api/banter', userId] })}
          />
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-700 rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
      <CardContent className="p-6">
        {/* Active Banter Queue */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Banter Queue</h2>
          <span className="text-sm text-gray-400" data-testid="text-queue-count">
            {unplayedBanters.length} pending
          </span>
        </div>
        
        {unplayedBanters.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No banter in queue</p>
            <p className="text-sm text-gray-500">Chat activity will generate witty responses</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {unplayedBanters.filter(banter => banter && banter.id).map((banter: BanterItem) => 
              renderBanterItem(banter)
            )}
          </div>
        )}



        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Banter</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Edit your banter text..."
                className="min-h-[100px]"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCloseEdit}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveEdit}
                  disabled={!editText.trim() || editBanterMutation.isPending}
                >
                  {editBanterMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}