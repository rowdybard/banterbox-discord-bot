import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Flag } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: 'voice' | 'personality';
  itemId: string;
  itemName: string;
}

const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'offensive', label: 'Offensive or Hateful' },
  { value: 'spam', label: 'Spam or Misleading' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' },
];

export function ReportDialog({ open, onOpenChange, itemType, itemId, itemName }: ReportDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  
  const reportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/marketplace/${itemType}/${itemId}/report`, {
        reason,
        description,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Submitted",
        description: "Thank you for helping keep our marketplace safe. We'll review this report shortly.",
      });
      onOpenChange(false);
      // Reset form
      setReason('');
      setDescription('');
    },
    onError: () => {
      toast({
        title: "Report Failed",
        description: "Could not submit your report. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = () => {
    if (!reason) {
      toast({
        title: "Reason Required",
        description: "Please select a reason for your report.",
        variant: "destructive",
      });
      return;
    }
    
    reportMutation.mutate();
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report {itemType === 'voice' ? 'Voice' : 'Personality'}
          </DialogTitle>
          <DialogDescription>
            Report "{itemName}" for violating our community guidelines.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Reason for Report</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={r.value} />
                  <Label htmlFor={r.value} className="font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">
              Additional Details (Optional)
            </Label>
            <Textarea
              id="description"
              placeholder="Please provide any additional context that might help us review this report..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={4}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reportMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reportMutation.isPending || !reason}
            className="bg-red-600 hover:bg-red-700"
          >
            {reportMutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
