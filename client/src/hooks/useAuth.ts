import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Log errors for debugging
  if (error) {
    console.error("Auth error:", error);
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error, // Expose error for debugging
  };
}