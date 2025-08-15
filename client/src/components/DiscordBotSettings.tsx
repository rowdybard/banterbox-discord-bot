import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, ExternalLink, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface LinkCode {
  code: string;
  expiresAt: string;
  instructions: string;
}

interface DiscordStatus {
  isConnected: boolean;
  connectedGuilds: number;
  guilds: Array<{
    guildId: string;
    linkedByUserId: string;
    createdAt: string;
  }>;
}

export function DiscordBotSettings() {
  const { user } = useAuth();
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Query Discord bot connection status
  const { data: status, isLoading: statusLoading } = useQuery<DiscordStatus>({
    queryKey: [`/api/discord/status/${user?.id}`],
    enabled: !!user?.id,
  });

  // Query bot invite URL
  const { data: inviteData } = useQuery<{ inviteUrl: string }>({
    queryKey: ["/api/discord/bot-invite"],
  });

  // Generate link code mutation
  const generateCodeMutation = useMutation({
    mutationFn: async (): Promise<LinkCode> => {
      const response = await apiRequest("POST", `/api/discord/link-code`);
      return await response.json();
    },
    onSuccess: (data: LinkCode) => {
      setLinkCode(data);
      toast({
        title: "Link code generated",
        description: "Use this code in Discord to link your server.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate link code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update countdown timer
  useEffect(() => {
    if (!linkCode) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(linkCode.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setLinkCode(null);
        toast({
          title: "Link code expired",
          description: "Please generate a new code.",
          variant: "destructive",
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [linkCode]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Link code copied successfully.",
    });
  };

  const openBotInvite = () => {
    if (inviteData?.inviteUrl) {
      window.open(inviteData.inviteUrl, '_blank');
    }
  };

  const refreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/discord/status/${user?.id}`] });
  };

  // Generate overlay URL dynamically
  const overlayUrl = `${window.location.protocol}//${window.location.host}/overlay`;

  if (statusLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#5865F2] rounded"></div>
            Discord Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="discord-bot-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#5865F2] rounded"></div>
          Discord Bot Integration
        </CardTitle>
        <CardDescription>
          Connect your Discord servers to BanterBox using our bot for reliable event processing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Connection Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Connection Status</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={refreshStatus}
              data-testid="button-refresh-status"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {status?.isConnected ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm">Connected to {status.connectedGuilds} server(s)</span>
                <Badge variant="secondary" className="bg-green-50 text-green-700">
                  Active
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-sm">Not connected to any servers</span>
                <Badge variant="secondary" className="bg-gray-50 text-gray-700">
                  Inactive
                </Badge>
              </>
            )}
          </div>

          {status?.guilds && status.guilds.length > 0 && (
            <div className="text-xs text-gray-500 space-y-1">
              {status.guilds.map((guild) => (
                <div key={guild.guildId} className="flex justify-between">
                  <span>Guild ID: {guild.guildId.slice(0, 8)}...</span>
                  <span>Connected: {new Date(guild.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discord Streaming Overlay - Only show when connected */}
        {status?.isConnected && (
          <div className="space-y-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-purple-500 rounded flex items-center justify-center">
                <ExternalLink className="h-3 w-3 text-white" />
              </div>
              <h3 className="text-sm font-medium text-purple-900">Discord Stream Overlay</h3>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                Ready for OBS
              </Badge>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-purple-800">
                Add this URL to OBS as a <strong>Browser Source</strong> for live Discord banter overlays:
              </p>
              
              <div className="flex items-center gap-2 p-3 bg-white rounded border">
                <code className="flex-1 font-mono text-sm break-all">
                  {overlayUrl}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(overlayUrl)}
                  data-testid="button-copy-overlay-url"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-xs text-purple-700 space-y-1">
                <p>• <strong>OBS Setup:</strong> Sources → Add → Browser Source → Paste URL above</p>
                <p>• <strong>Dimensions:</strong> Width: 1920, Height: 1080</p>
                <p>• <strong>Discord Streaming:</strong> Use <code>/join #voice-channel</code> to activate audio + overlay banters</p>
              </div>
            </div>
          </div>
        )}

        {/* Bot Setup Instructions */}
        {!status?.isConnected && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-medium text-blue-900">Setup Instructions</h3>
            <div className="space-y-3 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="font-medium">Invite BanterBox Bot to your Discord server</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={openBotInvite}
                    data-testid="button-invite-bot"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Invite Bot
                  </Button>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div className="flex-1">
                  <p className="font-medium">Generate a link code</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => generateCodeMutation.mutate()}
                    disabled={generateCodeMutation.isPending || !!linkCode}
                    data-testid="button-generate-code"
                  >
                    {generateCodeMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      "Generate Link Code"
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="font-medium">Use the code in your Discord server</p>
                  <p className="text-xs mt-1">Run the slash command: <code className="bg-blue-100 px-1 rounded">/link &lt;your-code&gt;</code></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Link Code Display */}
        {linkCode && (
          <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-medium text-green-900">Your Link Code</h3>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Expires in {formatTime(timeLeft)}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-white rounded border">
                <code className="flex-1 font-mono text-lg font-bold text-center">
                  {linkCode.code}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard(linkCode.code)}
                  data-testid="button-copy-code"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="text-sm text-green-800">
                <p className="font-medium">Discord Command:</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-white rounded border font-mono">
                    /link {linkCode.code}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyToClipboard(`/link ${linkCode.code}`)}
                    data-testid="button-copy-command"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Use <code>/join #voice-channel</code> to start streaming mode with audio banters</p>
          <p>• Use <code>/leave</code> to stop streaming mode (text-only banters)</p>
          <p>• Use <code>/config</code> in Discord to customize personality and voice settings</p>
          <p>• Perfect for Discord streamers - works with OBS overlays when in voice channels</p>
          <p>• <strong>Protected Sessions:</strong> Only streamers with proper roles or admins can control the bot</p>
          <p>• Multiple Discord servers can be linked to the same BanterBox workspace</p>
        </div>
      </CardContent>
    </Card>
  );
}