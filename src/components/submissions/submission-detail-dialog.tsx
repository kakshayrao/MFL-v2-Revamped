/**
 * Submission Detail Dialog
 * Displays full details of a submission including proof image, metrics, and status.
 */
'use client';

import * as React from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Footprints,
  Target,
  Dumbbell,
  Moon,
  CheckCircle2,
  XCircle,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Check,
  X,
  ShieldAlert,
  MessageSquare,
  Upload,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { MySubmission } from '@/hooks/use-my-submissions';
import { isExemptionRequest } from '@/hooks/use-my-submissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ============================================================================
// Types
// ============================================================================

interface SubmissionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: MySubmission | null;
  /** Whether the user can override/change the status (Host/Governor) */
  canOverride?: boolean;
  /** Called when user clicks approve/override to approved */
  onApprove?: (id: string) => void;
  /** Called when user clicks reject/override to rejected */
  onReject?: (id: string) => void;
  /** Whether a validation action is in progress */
  isValidating?: boolean;
  /** Whether this is the owner viewing their own submission */
  isOwner?: boolean;
  /** Called when user wants to reupload a rejected submission */
  onReupload?: (id: string) => void;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: MySubmission['status'] }) {
  const config = {
    pending: {
      label: 'Pending Review',
      icon: Clock3,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    approved: {
      label: 'Approved',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    rejected: {
      label: 'Rejected',
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn('gap-1.5 px-3 py-1', className)}>
      <Icon className="size-3.5" />
      {label}
    </Badge>
  );
}

// ============================================================================
// Metric Item Component
// ============================================================================

function MetricItem({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}) {
  if (value === null || value === undefined) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-semibold">
          {value}
          {unit && <span className="text-muted-foreground font-normal"> {unit}</span>}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Proof Image Component with Error Handling
// ============================================================================

function ProofImage({ url }: { url: string }) {
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-dashed text-muted-foreground">
        <ImageIcon className="size-8" />
        <span className="text-sm">Failed to load image</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(url, '_blank')}
        >
          <ExternalLink className="size-3.5 mr-1.5" />
          Try Opening Directly
        </Button>
      </div>
    );
  }

  return (
    <div className="relative group">
      <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center max-h-[400px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Submission proof"
          className={cn(
            'max-w-full max-h-[400px] w-auto h-auto object-contain',
            loading && 'opacity-0'
          )}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => window.open(url, '_blank')}
      >
        <ExternalLink className="size-3.5 mr-1.5" />
        Open Full Image
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SubmissionDetailDialog({
  open,
  onOpenChange,
  submission,
  canOverride = false,
  onApprove,
  onReject,
  isValidating = false,
  isOwner = false,
  onReupload,
}: SubmissionDetailDialogProps) {
  if (!submission) return null;

  const isPending = submission.status === 'pending';
  const isRejected = submission.status === 'rejected';
  const showApprove = isPending || (canOverride && submission.status !== 'approved');
  const showReject = isPending || (canOverride && submission.status !== 'rejected');
  const showActions = (showApprove || showReject) && (onApprove || onReject);
  const showReupload = isOwner && isRejected && onReupload;
  const isReupload = Boolean(submission.reupload_of);

  const isWorkout = submission.type === 'workout';
  const isRestDay = submission.type === 'rest';
  const isExemption = isExemptionRequest(submission);
  const formattedDate = format(parseISO(submission.date), 'EEEE, MMMM d, yyyy');
  const submittedAt = format(parseISO(submission.created_date), "MMM d, yyyy 'at' h:mm a");

  // Extract exemption reason from notes (remove the marker prefix)
  const exemptionReason = isExemption && submission.notes
    ? submission.notes.replace('[EXEMPTION_REQUEST]', '').trim()
    : null;

  // Format workout type for display
  const formatWorkoutType = (type: string | null) => {
    if (!type) return 'General Workout';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isWorkout ? (
                <Dumbbell className="size-5 text-primary" />
              ) : (
                <Moon className="size-5 text-blue-500" />
              )}
              {isWorkout ? 'Workout Submission' : 'Rest Day'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isReupload && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                  <RefreshCw className="size-3 mr-1" />
                  Re-submitted
                </Badge>
              )}
              <StatusBadge status={submission.status} />
            </div>
          </div>
          <DialogDescription className="flex items-center gap-1.5 text-sm">
            <Calendar className="size-3.5" />
            {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rejection Alert for Owner */}
          {isOwner && isRejected && submission.rejection_reason && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="size-4 text-red-600" />
              <AlertTitle className="text-red-800 dark:text-red-400">
                Submission Rejected
              </AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-300">
                <div className="mt-1">
                  <span className="font-medium">Reason: </span>
                  {submission.rejection_reason}
                </div>
                {showReupload && (
                  <div className="mt-3">
                    <p className="text-sm mb-2">
                      You can resubmit this workout with updated proof or corrections.
                    </p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Reupload Info Alert for Reviewers */}
          {!isOwner && isReupload && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <RefreshCw className="size-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-400">
                Resubmitted After Rejection
              </AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                This submission was previously rejected and has been resubmitted by the user for review.
              </AlertDescription>
            </Alert>
          )}

          {/* Exemption Request Alert */}
          {isExemption && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <ShieldAlert className="size-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-400">
                Rest Day Exemption Request
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                This is an exemption request beyond the player's rest day limit.
                {exemptionReason && (
                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="size-4 mt-0.5 shrink-0" />
                      <span className="italic">"{exemptionReason}"</span>
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Workout Type */}
          {isWorkout && submission.workout_type && (
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-sm text-muted-foreground">Activity Type</p>
              <p className="text-lg font-semibold">
                {formatWorkoutType(submission.workout_type)}
              </p>
            </div>
          )}

          {/* Metrics Grid */}
          {isWorkout && (
            <div className="grid grid-cols-2 gap-3">
              <MetricItem
                icon={Clock}
                label="Duration"
                value={submission.duration}
                unit="min"
              />
              <MetricItem
                icon={MapPin}
                label="Distance"
                value={submission.distance?.toFixed(2)}
                unit="km"
              />
              <MetricItem
                icon={Footprints}
                label="Steps"
                value={submission.steps?.toLocaleString()}
              />
              <MetricItem
                icon={Target}
                label="Holes"
                value={submission.holes}
              />
            </div>
          )}

          {/* RR Value */}
          {submission.rr_value !== null && submission.rr_value !== undefined && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Points Earned</p>
                  <p className="text-2xl font-bold text-primary">
                    {submission.rr_value.toFixed(1)} RR
                  </p>
                </div>
                <Target className="size-8 text-primary/50" />
              </div>
            </div>
          )}

          <Separator />

          {/* Proof Image */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Proof</p>
            {submission.proof_url ? (
              <ProofImage url={submission.proof_url} />
            ) : (
              <div className="flex items-center justify-center gap-2 p-6 rounded-lg border border-dashed text-muted-foreground">
                <ImageIcon className="size-5" />
                <span className="text-sm">No proof attached</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Submission Metadata */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Submitted: {submittedAt}</p>
            {submission.modified_date !== submission.created_date && (
              <p>
                Last updated:{' '}
                {format(parseISO(submission.modified_date), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
        </div>
        </div>

        {/* Action Footer for Host/Governor override only */}
        {showActions && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex w-full items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {isPending ? 'Review this submission' : 'Override status'}
                </p>
                <div className="flex gap-2">
                  {showReject && onReject && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => onReject(submission.id)}
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                      ) : (
                        <X className="size-4 mr-1.5" />
                      )}
                      {isPending ? 'Reject' : 'Override Reject'}
                    </Button>
                  )}
                  {showApprove && onApprove && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => onApprove(submission.id)}
                      disabled={isValidating}
                    >
                      {isValidating ? (
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                      ) : (
                        <Check className="size-4 mr-1.5" />
                      )}
                      {isPending ? 'Approve' : 'Override Approve'}
                    </Button>
                  )}
                </div>
              </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SubmissionDetailDialog;
