import { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  isLoading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  loadingText?: string;
  emptyState?: ReactNode;
  children: ReactNode;
  skeletonCount?: number;
}

export function LoadingState({
  isLoading,
  error,
  onRetry,
  loadingText = "Loading...",
  emptyState,
  children,
  skeletonCount = 3,
}: LoadingStateProps) {
  if (error) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-red-800/50">
        <CardContent className="p-6 text-center">
          <div className="text-red-400 mb-2">
            <RefreshCw className="h-8 w-8 mx-auto mb-2" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-400 mb-4">
            {error.message || "An unexpected error occurred"}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
              data-testid="button-retry"
            >
              Try Again
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-dark-lighter/50 backdrop-blur-lg border-gray-800">
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-gray-400">{loadingText}</p>
          </div>
          
          {/* Skeleton Loading */}
          <div className="space-y-3">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full bg-gray-700" />
                <Skeleton className="h-4 w-3/4 bg-gray-700" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

interface InlineLoadingProps {
  isLoading: boolean;
  text?: string;
  size?: "sm" | "md" | "lg";
}

export function InlineLoading({ isLoading, text = "Loading...", size = "md" }: InlineLoadingProps) {
  if (!isLoading) return null;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5", 
    lg: "h-6 w-6"
  };

  return (
    <div className="flex items-center gap-2 text-gray-400">
      <Loader2 className={`animate-spin ${sizeClasses[size]}`} />
      <span className="text-sm">{text}</span>
    </div>
  );
}

interface ButtonLoadingProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
}

export function ButtonLoading({ isLoading, children, loadingText }: ButtonLoadingProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        {loadingText && <span>{loadingText}</span>}
      </div>
    );
  }

  return <>{children}</>;
}