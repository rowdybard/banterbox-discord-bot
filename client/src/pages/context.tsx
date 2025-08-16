import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Brain, Clock, Activity, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface ContextMemory {
  id: string;
  eventType: string;
  contextSummary: string;
  importance: number;
  createdAt: string;
  expiresAt: string;
}

interface ActivitySummary {
  totalEvents: number;
  recentActivity: string;
  topEventTypes: string[];
}

interface ContextData {
  recentContext: ContextMemory[];
  activitySummary: ActivitySummary;
  timestamp: string;
}

export default function ContextPage() {
  const { user, isAuthenticated } = useAuth();

  const { data: contextData, isLoading, error } = useQuery<ContextData>({
    queryKey: ['/api/context', user?.id],
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Context Memory
            </CardTitle>
            <CardDescription>
              You need to be signed in to view AI context memory.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Context Memory</h1>
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-4/5" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Brain className="h-5 w-5" />
              Context Memory Error
            </CardTitle>
            <CardDescription>
              Failed to load context memory. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'chat':
      case 'discord_message':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'subscription':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'donation':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'raid':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'discord_member_join':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'discord_reaction':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 8) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    if (importance >= 6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    if (importance >= 4) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Context Memory
          </h1>
          <p className="text-muted-foreground mt-2">
            See what your AI remembers about recent stream activity to create more contextual banters.
          </p>
        </div>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Stream Activity Summary
            </CardTitle>
            <CardDescription>
              Overview of recent streaming activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {contextData?.activitySummary.totalEvents || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {contextData?.activitySummary.topEventTypes.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Event Types</div>
              </div>
              <div className="text-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {contextData?.activitySummary.topEventTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground mt-1">Top Activities</div>
              </div>
            </div>
            
            {contextData?.activitySummary.recentActivity && (
              <>
                <Separator className="my-4" />
                <div>
                  <h4 className="font-medium mb-2">Recent Activity</h4>
                  <p className="text-sm text-muted-foreground">
                    {contextData.activitySummary.recentActivity}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Context Memory Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Context Memory
            </CardTitle>
            <CardDescription>
              Events the AI remembers for contextual banter generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!contextData?.recentContext || contextData.recentContext.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Context Memory Yet</p>
                <p className="text-sm">
                  Start streaming and interacting to build AI context memory!
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {contextData.recentContext.map((memory) => (
                    <div
                      key={memory.id}
                      className="border rounded-lg p-4 space-y-2"
                      data-testid={`context-memory-${memory.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={getEventTypeColor(memory.eventType)}>
                            {memory.eventType.replace('_', ' ')}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={getImportanceColor(memory.importance)}
                          >
                            Importance: {memory.importance}/10
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(memory.createdAt), 'MMM d, HH:mm')}
                        </div>
                      </div>
                      
                      <p className="text-sm">
                        {memory.contextSummary}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires: {format(new Date(memory.expiresAt), 'MMM d, HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              How Context Memory Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">🧠 Smart Recording</h4>
                <p className="text-muted-foreground">
                  The AI automatically records chat messages, subscriptions, donations, and Discord activity as contextual memories.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">⏰ Automatic Expiry</h4>
                <p className="text-muted-foreground">
                  Memories automatically expire based on importance. High-impact events stay longer in memory.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">🎯 Contextual Responses</h4>
                <p className="text-muted-foreground">
                  New banters reference recent activity, creating more engaging and coherent responses.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">🔒 Privacy First</h4>
                <p className="text-muted-foreground">
                  Context memory is private to your account and automatically cleaned up over time.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center">
          Last updated: {contextData?.timestamp ? format(new Date(contextData.timestamp), 'PPpp') : 'Never'}
        </div>
      </div>
    </div>
  );
}