import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

export function AuthDebug() {
  const { user, isLoading, isAuthenticated, error } = useAuth();

  return (
    <Card className="bg-red-500/10 border-red-500/30 backdrop-blur-lg">
      <CardHeader>
        <CardTitle className="text-red-400 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5" />
          <span>Auth Debug Info</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-1">
          <p><strong>Loading:</strong> {isLoading ? "Yes" : "No"}</p>
          <p><strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}</p>
          <p><strong>User:</strong> {user ? "Loaded" : "Not loaded"}</p>
          {user && (
            <div className="ml-4 space-y-1">
              <p><strong>ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email || "None"}</p>
              <p><strong>Tier:</strong> {user.subscriptionTier || "None"}</p>
              <p><strong>Status:</strong> {user.subscriptionStatus || "None"}</p>
            </div>
          )}
          {error && (
            <div className="text-red-300">
              <p><strong>Error:</strong> {error.message}</p>
            </div>
          )}
        </div>
        
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white border-red-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reload Page
        </Button>
      </CardContent>
    </Card>
  );
}
