import { useQuery } from "@tanstack/react-query";
import { Play, Calendar, MessageSquare, Users, Gift, Zap, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { BanterItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface BanterHistoryProps {
  userId: string;
}

const eventTypeIcons = {
  chat: MessageSquare,
  subscribe: Users,
  cheer: Gift,
  raid: Zap,
  follow: Users,
};

const eventTypeColors = {
  chat: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  subscribe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  cheer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  raid: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  follow: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function BanterHistory({ userId }: BanterHistoryProps) {
  const { data: banters = [], isLoading } = useQuery({
    queryKey: ['/api/banter', userId],
    enabled: !!userId,
  }) as { data: BanterItem[], isLoading: boolean };

  const playBanter = async (banterId: string) => {
    try {
      await apiRequest('POST', `/api/banter/${banterId}/play`);
    } catch (error) {
      console.error('Error playing banter:', error);
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Banter History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">
                Loading banter history...
              </div>
            ) : banters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No banters generated yet. Start creating some witty responses!
              </div>
            ) : (
              banters.map((banter) => {
                const IconComponent = eventTypeIcons[banter.eventType as keyof typeof eventTypeIcons] || MessageSquare;
                const colorClass = eventTypeColors[banter.eventType as keyof typeof eventTypeColors] || eventTypeColors.chat;
                
                return (
                  <div
                    key={banter.id}
                    data-testid={`banter-item-${banter.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <Badge className={colorClass}>
                        <IconComponent className="h-3 w-3 mr-1" />
                        {banter.eventType}
                      </Badge>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {banter.banterText}
                      </div>
                      {banter.originalMessage && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          Original: "{banter.originalMessage}"
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {formatDate(banter.createdAt || new Date().toISOString())}
                        {banter.isPlayed && (
                          <Badge variant="outline" className="text-xs">
                            Played
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {banter.audioUrl && (
                      <Button
                        data-testid={`button-play-${banter.id}`}
                        size="sm"
                        variant="ghost"
                        onClick={() => playBanter(banter.id)}
                        className="flex-shrink-0"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}