import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface RatingButtonsProps {
  itemType: 'voice' | 'personality';
  itemId: string;
  upvotes: number;
  downvotes: number;
  size?: 'sm' | 'default';
}

export function RatingButtons({ itemType, itemId, upvotes, downvotes, size = 'default' }: RatingButtonsProps) {
  const { toast } = useToast();
  const [optimisticUpvotes, setOptimisticUpvotes] = useState(upvotes);
  const [optimisticDownvotes, setOptimisticDownvotes] = useState(downvotes);
  
  // Get user's current rating
  const { data: userRating } = useQuery({
    queryKey: ['/api/marketplace', itemType, itemId, 'rating'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/marketplace/${itemType}/${itemId}/rating`);
      return response.json();
    },
  });
  
  const currentRating = userRating?.rating || 0;
  
  // Update local state when props change
  useEffect(() => {
    setOptimisticUpvotes(upvotes);
    setOptimisticDownvotes(downvotes);
  }, [upvotes, downvotes]);
  
  // Rate mutation
  const rateMutation = useMutation({
    mutationFn: async (rating: 1 | -1) => {
      const response = await apiRequest('POST', `/api/marketplace/${itemType}/${itemId}/rate`, { rating });
      return response.json();
    },
    onMutate: async (rating) => {
      // Optimistic update
      if (currentRating === rating) {
        // Clicking same button = removing vote
        if (rating === 1) {
          setOptimisticUpvotes(prev => prev - 1);
        } else {
          setOptimisticDownvotes(prev => prev - 1);
        }
      } else {
        // Changing vote or new vote
        if (currentRating === 1) {
          setOptimisticUpvotes(prev => prev - 1);
        } else if (currentRating === -1) {
          setOptimisticDownvotes(prev => prev - 1);
        }
        
        if (rating === 1) {
          setOptimisticUpvotes(prev => prev + 1);
        } else {
          setOptimisticDownvotes(prev => prev + 1);
        }
      }
    },
    onSuccess: () => {
      // Invalidate queries to get fresh data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketplace', itemType, itemId, 'rating'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/marketplace', itemType === 'voice' ? 'voices' : 'personalities'] 
      });
    },
    onError: () => {
      // Revert optimistic update
      setOptimisticUpvotes(upvotes);
      setOptimisticDownvotes(downvotes);
      toast({
        title: "Rating Failed",
        description: "Could not update your rating. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleUpvote = () => {
    rateMutation.mutate(1);
  };
  
  const handleDownvote = () => {
    rateMutation.mutate(-1);
  };
  
  const buttonSize = size === 'sm' ? 'sm' : 'default';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={currentRating === 1 ? "default" : "outline"}
        size={buttonSize}
        onClick={handleUpvote}
        disabled={rateMutation.isPending}
        className={cn(
          "gap-1",
          currentRating === 1 && "bg-green-600 hover:bg-green-700"
        )}
      >
        <ThumbsUp className={iconSize} />
        <span>{optimisticUpvotes}</span>
      </Button>
      
      <Button
        variant={currentRating === -1 ? "default" : "outline"}
        size={buttonSize}
        onClick={handleDownvote}
        disabled={rateMutation.isPending}
        className={cn(
          "gap-1",
          currentRating === -1 && "bg-red-600 hover:bg-red-700"
        )}
      >
        <ThumbsDown className={iconSize} />
        <span>{optimisticDownvotes}</span>
      </Button>
    </div>
  );
}
