/**
 * Reupload Dialog
 * Allows users to reupload a rejected submission with updated proof/notes.
 */
'use client';

import * as React from 'react';
import { Upload, Loader2, ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

import type { MySubmission } from '@/hooks/use-my-submissions';

interface ReuploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: MySubmission | null;
  onSuccess?: () => void;
}

export function ReuploadDialog({
  open,
  onOpenChange,
  submission,
  onSuccess,
}: ReuploadDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    proof_url: '',
    notes: '',
    duration: '',
    distance: '',
    steps: '',
    holes: '',
  });

  // Reset form when submission changes
  React.useEffect(() => {
    if (submission && open) {
      setFormData({
        proof_url: submission.proof_url || '',
        notes: submission.notes || '',
        duration: submission.duration?.toString() || '',
        distance: submission.distance?.toString() || '',
        steps: submission.steps?.toString() || '',
        holes: submission.holes?.toString() || '',
      });
    }
  }, [submission, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;

    setIsLoading(true);

    try {
      const payload: Record<string, any> = {};

      // Only include changed fields
      if (formData.proof_url && formData.proof_url !== submission.proof_url) {
        payload.proof_url = formData.proof_url;
      }
      if (formData.notes !== submission.notes) {
        payload.notes = formData.notes;
      }
      if (formData.duration && formData.duration !== submission.duration?.toString()) {
        payload.duration = parseInt(formData.duration);
      }
      if (formData.distance && formData.distance !== submission.distance?.toString()) {
        payload.distance = parseFloat(formData.distance);
      }
      if (formData.steps && formData.steps !== submission.steps?.toString()) {
        payload.steps = parseInt(formData.steps);
      }
      if (formData.holes && formData.holes !== submission.holes?.toString()) {
        payload.holes = parseInt(formData.holes);
      }

      const response = await fetch(`/api/submissions/${submission.id}/reupload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reupload submission');
      }

      toast.success(data.message || 'Submission reuploaded successfully!');
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Error reuploading submission:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reupload submission');
    } finally {
      setIsLoading(false);
    }
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            Reupload Submission
          </DialogTitle>
          <DialogDescription>
            Update your submission with new proof or corrections. The submission will be reviewed again.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proof URL */}
          <div className="space-y-2">
            <Label htmlFor="proof_url">
              Proof Image URL
              {submission.rejection_reason?.toLowerCase().includes('proof') && (
                <span className="text-red-600 ml-1">*</span>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="proof_url"
                type="url"
                placeholder="https://..."
                value={formData.proof_url}
                onChange={(e) => setFormData({ ...formData, proof_url: e.target.value })}
              />
              {formData.proof_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(formData.proof_url, '_blank')}
                >
                  <ImageIcon className="size-4" />
                </Button>
              )}
            </div>
            {submission.rejection_reason?.toLowerCase().includes('proof') && (
              <p className="text-xs text-muted-foreground">
                Your submission was rejected due to proof issues. Please provide a valid proof image.
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes or explanations about the changes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {/* Workout Metrics (only if workout) */}
          {submission.type === 'workout' && (
            <div className="grid grid-cols-2 gap-3">
              {submission.duration !== null && (
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    placeholder="30"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />
                </div>
              )}
              {submission.distance !== null && (
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5.0"
                    value={formData.distance}
                    onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                  />
                </div>
              )}
              {submission.steps !== null && (
                <div className="space-y-2">
                  <Label htmlFor="steps">Steps</Label>
                  <Input
                    id="steps"
                    type="number"
                    min="0"
                    placeholder="10000"
                    value={formData.steps}
                    onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                  />
                </div>
              )}
              {submission.holes !== null && (
                <div className="space-y-2">
                  <Label htmlFor="holes">Holes</Label>
                  <Input
                    id="holes"
                    type="number"
                    min="1"
                    placeholder="18"
                    value={formData.holes}
                    onChange={(e) => setFormData({ ...formData, holes: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Reuploading...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Reupload
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
