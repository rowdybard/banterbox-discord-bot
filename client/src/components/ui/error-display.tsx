import { AlertCircle, RefreshCw, Wifi } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, className }: ErrorDisplayProps) {
  // Parse error message
  const getErrorDetails = () => {
    if (typeof error === 'string') {
      return { title: "Error", message: error };
    }
    
    if (error?.message) {
      // Check for specific error types
      if (error.message.includes('429') || error.message.includes('Daily limit')) {
        return {
          title: "Daily Limit Reached",
          message: error.message,
          variant: "default" as const,
          showUpgrade: true
        };
      }
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return {
          title: "Authentication Required",
          message: "Please log in to continue",
          variant: "destructive" as const,
          showLogin: true
        };
      }
      
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        return {
          title: "Connection Error",
          message: "Unable to connect to the server. Please check your internet connection.",
          variant: "destructive" as const,
          icon: <Wifi className="h-4 w-4" />
        };
      }
      
      if (error.message.includes('500') || error.message.includes('Internal')) {
        return {
          title: "Server Error",
          message: "Something went wrong on our end. Please try again later.",
          variant: "destructive" as const
        };
      }
      
      return {
        title: "Error",
        message: error.message,
        variant: "destructive" as const
      };
    }
    
    return {
      title: "Unexpected Error",
      message: "An unexpected error occurred. Please try again.",
      variant: "destructive" as const
    };
  };
  
  const details = getErrorDetails();
  
  return (
    <Alert variant={details.variant || "destructive"} className={className}>
      {details.icon || <AlertCircle className="h-4 w-4" />}
      <AlertTitle>{details.title}</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>{details.message}</p>
        
        {details.showUpgrade && (
          <Button
            variant="link"
            className="p-0 h-auto font-semibold"
            onClick={() => window.location.href = '/pro'}
          >
            Upgrade to Pro for unlimited banters →
          </Button>
        )}
        
        {details.showLogin && (
          <Button
            variant="link"
            className="p-0 h-auto font-semibold"
            onClick={() => window.location.href = '/api/login'}
          >
            Log in →
          </Button>
        )}
        
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}