/**
 * Submit Activity Page
 * Allows players to submit workout entries with proof image upload.
 */
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import Tesseract from 'tesseract.js';
import Confetti from 'react-confetti';
import {
  Dumbbell,
  Upload,
  Calendar as CalendarIcon,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Image as ImageIcon,
  X,
  AlertCircle,
  PartyPopper,
  RotateCcw,
  Eye,
  Moon,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLeague } from '@/contexts/league-context';
import { useRole } from '@/contexts/role-context';
import { useLeagueActivities } from '@/hooks/use-league-activities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================================================
// Rest Day Stats Interface
// ============================================================================

interface RestDayStats {
  totalAllowed: number;
  used: number;
  pending: number;
  remaining: number;
  isAtLimit: boolean;
  exemptionsPending: number;
  restDaysPerWeek: number;
  leagueWeeks: number;
}

// ============================================================================
// Activity Type Interface
// ============================================================================

interface ActivityType {
  value: string;
  label: string;
  description?: string | null;
}

// ============================================================================
// Submit Activity Page
// ============================================================================

export default function SubmitActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeLeague } = useLeague();
  const { canSubmitWorkouts } = useRole();

  // Check if this is a resubmission
  const resubmitId = searchParams.get('resubmit');
  const isResubmission = !!resubmitId;

  // Fetch league activities
  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    error: activitiesError,
    errorCode: activitiesErrorCode,
  } = useLeagueActivities(leagueId);

  // Transform fetched activities to the format needed by the UI
  const activityTypes: ActivityType[] = React.useMemo(() => {
    if (!activitiesData?.activities) return [];
    return activitiesData.activities.map((activity) => ({
      value: activity.value,
      label: activity.activity_name,
      description: activity.description,
    }));
  }, [activitiesData?.activities]);

  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [submittedData, setSubmittedData] = React.useState<any>(null);
  const [activityDate, setActivityDate] = React.useState<Date>(new Date());
  const [formData, setFormData] = React.useState({
    activity_type: '',
    duration: '',
    distance: '',
    steps: '',
    holes: '',
    notes: '',
  });

  // Submission type tab state
  const [submissionType, setSubmissionType] = React.useState<'workout' | 'rest'>('workout');

  // Rest day stats
  const [restDayStats, setRestDayStats] = React.useState<RestDayStats | null>(null);
  const [restDayLoading, setRestDayLoading] = React.useState(false);
  const [restDayReason, setRestDayReason] = React.useState('');
  const [isExemptionRequest, setIsExemptionRequest] = React.useState(false);

  // Fetch rest day stats
  const fetchRestDayStats = React.useCallback(async () => {
    if (!leagueId) return;
    setRestDayLoading(true);
    try {
      const response = await fetch(`/api/leagues/${leagueId}/rest-days`);
      const result = await response.json();
      if (response.ok && result.success) {
        setRestDayStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch rest day stats:', error);
    } finally {
      setRestDayLoading(false);
    }
  }, [leagueId]);

  // Fetch rest day stats on mount and when switching to rest tab
  React.useEffect(() => {
    if (submissionType === 'rest') {
      fetchRestDayStats();
    }
  }, [submissionType, fetchRestDayStats]);

  // Pre-fill form data when resubmitting
  React.useEffect(() => {
    if (resubmitId) {
      const dateParam = searchParams.get('date');
      const typeParam = searchParams.get('type');
      const workoutTypeParam = searchParams.get('workout_type');
      const durationParam = searchParams.get('duration');
      const distanceParam = searchParams.get('distance');
      const stepsParam = searchParams.get('steps');
      const holesParam = searchParams.get('holes');
      const notesParam = searchParams.get('notes');
      const proofUrlParam = searchParams.get('proof_url');

      // Set submission type
      if (typeParam === 'rest') {
        setSubmissionType('rest');
      } else {
        setSubmissionType('workout');
      }

      // Set date
      if (dateParam) {
        try {
          setActivityDate(parseISO(dateParam));
        } catch (e) {
          console.error('Invalid date parameter:', e);
        }
      }

      // Set form data
      setFormData({
        activity_type: workoutTypeParam || '',
        duration: durationParam || '',
        distance: distanceParam || '',
        steps: stepsParam || '',
        holes: holesParam || '',
        notes: notesParam || '',
      });

      // Set proof URL as image preview (if it's a URL)
      if (proofUrlParam) {
        setImagePreview(proofUrlParam);
      }

      toast.info('Resubmitting rejected workout. Update as needed.');
    }
  }, [resubmitId, searchParams]);

  // Image upload state - store file in memory until submission
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // OCR state
  const [ocrProcessing, setOcrProcessing] = React.useState(false);
  const [ocrDialogOpen, setOcrDialogOpen] = React.useState(false);
  const [ocrResult, setOcrResult] = React.useState<{ raw: string; minutes: number } | null>(null);

  // Confetti state for success dialog
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [windowSize, setWindowSize] = React.useState({ width: 0, height: 0 });

  // Window size for confetti
  React.useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  // Trigger confetti on success after 500ms
  React.useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        setShowConfetti(true);
        // Stop confetti after 5 seconds
        setTimeout(() => setShowConfetti(false), 5000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const selectedActivity = activityTypes.find(
    (a) => a.value === formData.activity_type
  );

  // Estimated RR calculation (simplified - actual calculation done on backend)
  const estimatedRR = React.useMemo(() => {
    if (!selectedActivity) return 0;
    const activityValue = formData.activity_type;

    // Simplified estimates based on backend RR calculation logic
    if (activityValue === 'steps' && formData.steps) {
      const steps = parseInt(formData.steps);
      if (steps < 10000) return 0;
      return Math.min(1 + (steps - 10000) / 10000, 2.0);
    }

    if (activityValue === 'golf' && formData.holes) {
      const holes = parseInt(formData.holes);
      return Math.min(holes / 9, 2.0);
    }

    if (formData.duration) {
      const duration = parseInt(formData.duration);
      return Math.min(duration / 45, 2.0);
    }

    return 1.0;
  }, [selectedActivity, formData]);

  // Parse workout time from OCR text
  const parseWorkoutTime = (text: string): { raw: string; minutes: number } | null => {
    const timePattern = /(\d{1,2}):(\d{2}):(\d{2})/;
    const match = text.match(timePattern);

    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const seconds = parseInt(match[3]);
      const totalMinutes = hours * 60 + minutes + Math.round(seconds / 60);

      return {
        raw: `${match[1]}:${match[2]}:${match[3]}`,
        minutes: totalMinutes,
      };
    }

    return null;
  };

  // Handle file selection - store in memory, don't upload yet
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPG, PNG, GIF, WebP');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 10MB');
      return;
    }

    // Store file in memory
    setSelectedFile(file);

    // Create image preview from memory
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    toast.success('Image selected. It will be uploaded when you submit.');

    // Try OCR processing on the local file
    setOcrProcessing(true);
    try {
      const ocrResult = await Tesseract.recognize(file, 'eng', {
        logger: (m) => console.log(m),
      });

      const workoutTime = parseWorkoutTime(ocrResult.data.text);

      if (workoutTime) {
        setOcrResult(workoutTime);
        setFormData((prev) => ({ ...prev, duration: workoutTime.minutes.toString() }));
        setOcrDialogOpen(true);
      }
    } catch (ocrError) {
      console.warn('OCR processing failed:', ocrError);
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit the activity
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.activity_type) {
      toast.error('Please select an activity type');
      return;
    }

    if (!formData.duration && formData.activity_type !== 'steps' && formData.activity_type !== 'golf') {
      toast.error('Please enter duration');
      return;
    }

    // Enforce RR eligibility: RR must be between 1 and 2.
    // We use a backend preview so age-based thresholds match server logic.
    try {
      const previewPayload: Record<string, any> = {
        league_id: leagueId,
        type: 'workout',
        workout_type: formData.activity_type,
      };
      if (formData.duration) previewPayload.duration = parseInt(formData.duration);
      if (formData.distance) previewPayload.distance = parseFloat(formData.distance);
      if (formData.steps) previewPayload.steps = parseInt(formData.steps);
      if (formData.holes) previewPayload.holes = parseInt(formData.holes);

      const previewRes = await fetch('/api/entries/preview-rr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewPayload),
      });
      const previewJson = await previewRes.json();
      if (!previewRes.ok) {
        throw new Error(previewJson.error || 'Failed to validate RR');
      }
      const canSubmit = Boolean(previewJson?.data?.canSubmit);
      if (!canSubmit) {
        toast.error('Workout RR must be at least 1.0 to submit. Please increase duration/distance/steps.');
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to validate RR');
      return;
    }

    if (!selectedFile) {
      toast.error('Proof screenshot is required');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Upload image to bucket if one is selected
      let proofUrl: string | null = null;
      if (selectedFile) {
        setUploadingImage(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('league_id', leagueId);

        const uploadResponse = await fetch('/api/upload/proof', {
          method: 'POST',
          body: uploadFormData,
        });

        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || 'Failed to upload proof image');
        }

        proofUrl = uploadResult.data.url;
        setUploadingImage(false);
      }

      // Step 2: Submit the activity entry
      const payload: Record<string, any> = {
        league_id: leagueId,
        date: format(activityDate, 'yyyy-MM-dd'),
        type: 'workout',
        workout_type: formData.activity_type,
        proof_url: proofUrl,
      };

      // Add relevant metrics based on activity type
      if (formData.duration) {
        payload.duration = parseInt(formData.duration);
      }
      if (formData.distance) {
        payload.distance = parseFloat(formData.distance);
      }
      if (formData.steps) {
        payload.steps = parseInt(formData.steps);
      }
      if (formData.holes) {
        payload.holes = parseInt(formData.holes);
      }
      
      // Add notes if provided
      if (formData.notes) {
        payload.notes = formData.notes;
      }
      
      // Add reupload_of if this is a resubmission
      if (resubmitId) {
        payload.reupload_of = resubmitId;
      }

      const response = await fetch('/api/entries/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit activity');
      }

      setSubmittedData(result.data);
      setSubmitted(true);
      toast.success('Activity submitted successfully!');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit activity');
      setUploadingImage(false);
    } finally {
      setLoading(false);
    }
  };

  // Submit rest day
  const handleRestDaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if this is an exemption request (over limit)
      const needsExemption = restDayStats?.isAtLimit || false;

      const payload: Record<string, any> = {
        league_id: leagueId,
        date: format(activityDate, 'yyyy-MM-dd'),
        type: 'rest',
        // Add notes - if exemption, prefix with marker
        notes: needsExemption
          ? `[EXEMPTION_REQUEST] ${restDayReason || 'Rest day exemption requested'}`
          : restDayReason || undefined,
      };

      const response = await fetch('/api/entries/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit rest day');
      }

      setSubmittedData({
        ...result.data,
        isRestDay: true,
        isExemption: needsExemption,
      });
      setSubmitted(true);

      if (needsExemption) {
        toast.success('Rest day exemption request submitted! Awaiting approval.');
      } else {
        toast.success('Rest day logged successfully!');
      }

      // Refresh rest day stats
      fetchRestDayStats();
    } catch (error) {
      console.error('Rest day submit error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit rest day');
    } finally {
      setLoading(false);
    }
  };

  // Access check
  if (!canSubmitWorkouts) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Access Restricted</AlertTitle>
          <AlertDescription>
            You must be a player in this league to submit activities.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state for activities
  if (activitiesLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 lg:gap-6 lg:p-6">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading activities...</p>
      </div>
    );
  }

  // No activities configured check
  if (activitiesErrorCode === 'NO_ACTIVITIES_CONFIGURED' || activityTypes.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Activities Not Configured</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>This league does not have any activities configured yet.</p>
            <p className="text-sm">Please contact the league host to configure activities before submitting workouts.</p>
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild className="w-fit">
          <Link href={`/leagues/${leagueId}`}>Back to League</Link>
        </Button>
      </div>
    );
  }

  // Success Dialog Handler
  const handleSubmitAnother = () => {
    setSubmitted(false);
    setSubmittedData(null);
    setShowConfetti(false);
    setFormData({
      activity_type: '',
      duration: '',
      distance: '',
      steps: '',
      holes: '',
      notes: '',
    });
    setSelectedFile(null);
    setImagePreview(null);
    setRestDayReason('');
    setIsExemptionRequest(false);
    // Refresh rest day stats if on rest tab
    if (submissionType === 'rest') {
      fetchRestDayStats();
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Submit Activity</h1>
          <p className="text-muted-foreground">
            Log your workout or rest day to earn points
            {activeLeague?.team_name && (
              <> - <span className="font-medium">{activeLeague.team_name}</span></>
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/leagues/${leagueId}`}>Cancel</Link>
        </Button>
      </div>

      {/* Submission Type Tabs */}
      <Tabs value={submissionType} onValueChange={(v) => setSubmissionType(v as 'workout' | 'rest')} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="workout" className="flex items-center gap-2">
            <Dumbbell className="size-4" />
            Workout
          </TabsTrigger>
          <TabsTrigger value="rest" className="flex items-center gap-2">
            <Moon className="size-4" />
            Rest Day
          </TabsTrigger>
        </TabsList>

        {/* Workout Tab Content */}
        <TabsContent value="workout" className="mt-6">
          <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Type */}
            <div className="rounded-lg border">
              <div className="border-b bg-muted/50 px-4 py-3">
                <h2 className="font-semibold">Activity Type</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activityTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          activity_type: type.value,
                        }))
                      }
                      className={cn(
                        'p-3 rounded-lg border text-center transition-all hover:border-primary/50',
                        formData.activity_type === type.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-background'
                      )}
                    >
                      <span className="text-sm font-medium block">
                        {type.label}
                      </span>
                      {type.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {type.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity Details */}
            <div className="rounded-lg border">
              <div className="border-b bg-muted/50 px-4 py-3">
                <h2 className="font-semibold">Activity Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Duration - for most activities */}
                  {formData.activity_type !== 'steps' && formData.activity_type !== 'golf' && (
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes) *</Label>
                      <Input
                        id="duration"
                        type="number"
                        min="1"
                        max="300"
                        placeholder="e.g., 45"
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            duration: e.target.value,
                          }))
                        }
                        required={formData.activity_type !== 'steps' && formData.activity_type !== 'golf'}
                      />
                    </div>
                  )}

                  {/* Distance - for cardio/run/cycling */}
                  {['cardio', 'run', 'cycling', 'swimming'].includes(formData.activity_type) && (
                    <div className="space-y-2">
                      <Label htmlFor="distance">Distance (km)</Label>
                      <Input
                        id="distance"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g., 5.5"
                        value={formData.distance}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            distance: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  {/* Steps - for steps activity */}
                  {formData.activity_type === 'steps' && (
                    <div className="space-y-2">
                      <Label htmlFor="steps">Step Count *</Label>
                      <Input
                        id="steps"
                        type="number"
                        min="1"
                        placeholder="e.g., 10000"
                        value={formData.steps}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            steps: e.target.value,
                          }))
                        }
                        required={formData.activity_type === 'steps'}
                      />
                    </div>
                  )}

                  {/* Holes - for golf */}
                  {formData.activity_type === 'golf' && (
                    <div className="space-y-2">
                      <Label htmlFor="holes">Holes Played *</Label>
                      <Input
                        id="holes"
                        type="number"
                        min="1"
                        max="36"
                        placeholder="e.g., 18"
                        value={formData.holes}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            holes: e.target.value,
                          }))
                        }
                        required={formData.activity_type === 'golf'}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Activity Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {format(activityDate, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={activityDate}
                          onSelect={(date) => date && setActivityDate(date)}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any details about your workout..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="rounded-lg border">
              <div className="border-b bg-muted/50 px-4 py-3">
                <h2 className="font-semibold">Upload Proof Screenshot *</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload a screenshot from your fitness app. We'll try to auto-extract duration.
                </p>
              </div>
              <div className="p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Selected workout"
                      className="w-full h-48 object-contain rounded-lg border bg-muted"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={removeImage}
                    >
                      <X className="size-4" />
                    </Button>
                    <Badge className="absolute bottom-2 left-2 bg-amber-600">
                      <CheckCircle2 className="size-3 mr-1" />
                      Ready to upload
                    </Badge>
                  </div>
                ) : (
                  <div
                    onClick={handleUploadClick}
                    className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    {uploadingImage || ocrProcessing ? (
                      <>
                        <Loader2 className="size-8 mx-auto text-primary mb-2 animate-spin" />
                        <p className="text-sm font-medium mb-1">
                          {uploadingImage ? 'Uploading...' : 'Processing image...'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ocrProcessing ? 'Extracting workout data' : 'Please wait'}
                        </p>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="size-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium mb-1">
                          Upload workout screenshot
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, GIF, WebP - Max 10MB
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="rounded-lg border sticky top-6">
              <div className="border-b bg-muted/50 px-4 py-3">
                <h2 className="font-semibold">Summary</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activity</span>
                    <span className="font-medium">
                      {selectedActivity?.label || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {formData.activity_type === 'steps' ? 'Steps' :
                      formData.activity_type === 'golf' ? 'Holes' : 'Duration'}
                    </span>
                    <span className="font-medium">
                      {formData.activity_type === 'steps' && formData.steps ? `${formData.steps} steps` :
                      formData.activity_type === 'golf' && formData.holes ? `${formData.holes} holes` :
                      formData.duration ? `${formData.duration} min` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {format(activityDate, 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proof</span>
                    <span className="font-medium">
                      {selectedFile ? (
                        <span className="text-amber-600">Selected</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* RR Estimate */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Estimated RR
                    </span>
                    <span className="text-xl font-bold text-primary">
                      ~{estimatedRR.toFixed(1)} RR
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Final RR calculated on submission
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || uploadingImage || !formData.activity_type || !selectedFile}
                >
                  {loading || uploadingImage ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {uploadingImage ? 'Uploading proof...' : 'Submitting...'}
                    </>
                  ) : (
                    <>
                      Submit Activity
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground">
                  Your submission will be reviewed by your team captain before
                  points are awarded.
                </p>
              </div>
            </div>
          </div>
        </div>
          </form>
        </TabsContent>

        {/* Rest Day Tab Content */}
        <TabsContent value="rest" className="mt-6">
          <form onSubmit={handleRestDaySubmit}>
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Rest Day Stats Card */}
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/50 px-4 py-3">
                    <h2 className="font-semibold flex items-center gap-2">
                      <Moon className="size-4" />
                      Rest Day Allowance
                    </h2>
                  </div>
                  <div className="p-4">
                    {restDayLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : restDayStats ? (
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Rest days used</span>
                            <span className="font-medium">
                              {restDayStats.used} / {restDayStats.totalAllowed}
                            </span>
                          </div>
                          <Progress
                            value={(restDayStats.used / restDayStats.totalAllowed) * 100}
                            className={cn(
                              'h-2',
                              restDayStats.isAtLimit && '[&>div]:bg-amber-500'
                            )}
                          />
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="text-2xl font-bold text-green-600">
                              {restDayStats.remaining}
                            </div>
                            <div className="text-xs text-muted-foreground">Remaining</div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="text-2xl font-bold">
                              {restDayStats.used}
                            </div>
                            <div className="text-xs text-muted-foreground">Used</div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="text-2xl font-bold text-amber-600">
                              {restDayStats.pending}
                            </div>
                            <div className="text-xs text-muted-foreground">Pending</div>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                          <Info className="size-4 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-medium">{restDayStats.restDaysPerWeek} rest day{restDayStats.restDaysPerWeek > 1 ? 's' : ''} per week</span>
                            {' '}× {restDayStats.leagueWeeks} weeks = {restDayStats.totalAllowed} total rest days allowed
                          </div>
                        </div>

                        {/* At Limit Warning */}
                        {restDayStats.isAtLimit && (
                          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                            <ShieldAlert className="size-4 text-amber-600" />
                            <AlertTitle className="text-amber-800 dark:text-amber-400">Rest Day Limit Reached</AlertTitle>
                            <AlertDescription className="text-amber-700 dark:text-amber-300">
                              You've used all your rest days. Any additional rest day will be submitted as an
                              <strong> exemption request</strong> and requires approval from your Captain or Governor.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Unable to load rest day stats
                      </p>
                    )}
                  </div>
                </div>

                {/* Rest Day Form */}
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/50 px-4 py-3">
                    <h2 className="font-semibold">
                      {restDayStats?.isAtLimit ? 'Request Rest Day Exemption' : 'Log Rest Day'}
                    </h2>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Date Picker */}
                    <div className="space-y-2">
                      <Label>Rest Day Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 size-4" />
                            {format(activityDate, 'PPP')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={activityDate}
                            onSelect={(date) => date && setActivityDate(date)}
                            disabled={(date) => date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Reason (optional, required for exemption) */}
                    <div className="space-y-2">
                      <Label htmlFor="restReason">
                        {restDayStats?.isAtLimit ? 'Reason for Exemption *' : 'Reason (Optional)'}
                      </Label>
                      <Textarea
                        id="restReason"
                        placeholder={
                          restDayStats?.isAtLimit
                            ? 'Please explain why you need an additional rest day...'
                            : 'E.g., Recovery day, feeling unwell, etc.'
                        }
                        value={restDayReason}
                        onChange={(e) => setRestDayReason(e.target.value)}
                        rows={3}
                        required={restDayStats?.isAtLimit}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <div className="rounded-lg border sticky top-6">
                  <div className="border-b bg-muted/50 px-4 py-3">
                    <h2 className="font-semibold">Summary</h2>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium flex items-center gap-1">
                          <Moon className="size-3" />
                          Rest Day
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {format(activityDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className="font-medium">
                          {restDayStats?.isAtLimit ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Exemption Request
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              Within Limit
                            </Badge>
                          )}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* RR Value */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          RR Points
                        </span>
                        <span className="text-xl font-bold text-primary">
                          +1.0 RR
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Rest days earn 1.0 RR when approved
                      </p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || (restDayStats?.isAtLimit && !restDayReason.trim())}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Submitting...
                        </>
                      ) : restDayStats?.isAtLimit ? (
                        <>
                          Request Exemption
                          <ArrowRight className="ml-2 size-4" />
                        </>
                      ) : (
                        <>
                          Log Rest Day
                          <ArrowRight className="ml-2 size-4" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      {restDayStats?.isAtLimit
                        ? 'Your exemption request will be reviewed by your Captain or Governor.'
                        : 'Rest days help you recover while maintaining your streak.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {/* OCR Success Dialog */}
      <AlertDialog open={ocrDialogOpen} onOpenChange={setOcrDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-6 text-green-600" />
            </div>
            <AlertDialogTitle className="text-center">Duration Detected!</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              We extracted the workout duration from your screenshot
            </AlertDialogDescription>
          </AlertDialogHeader>
          {ocrResult && (
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground mb-2">Time found:</div>
              <div className="text-2xl font-bold text-primary mb-1">{ocrResult.raw}</div>
              <div className="text-sm text-muted-foreground">
                Converted to <span className="font-semibold text-foreground">{ocrResult.minutes} minutes</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction>Got it!</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog with Confetti */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.2}
          colors={['#22c55e', '#10b981', '#14b8a6', '#6366f1', '#8b5cf6', '#f59e0b']}
        />
      )}

      <Dialog open={submitted} onOpenChange={(open) => !open && handleSubmitAnother()}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4">
              <div className={cn(
                "size-20 rounded-full flex items-center justify-center animate-bounce",
                submittedData?.isExemption
                  ? "bg-gradient-to-br from-amber-400 to-orange-600"
                  : submittedData?.isRestDay
                  ? "bg-gradient-to-br from-blue-400 to-indigo-600"
                  : "bg-gradient-to-br from-green-400 to-emerald-600"
              )}>
                {submittedData?.isRestDay ? (
                  <Moon className="size-10 text-white" />
                ) : (
                  <PartyPopper className="size-10 text-white" />
                )}
              </div>
            </div>
            <DialogTitle className="text-2xl">
              {submittedData?.isExemption
                ? 'Exemption Request Submitted!'
                : submittedData?.isRestDay
                ? 'Rest Day Logged!'
                : 'Activity Submitted!'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {submittedData?.isExemption
                ? 'Your rest day exemption request has been submitted and is awaiting approval from your Captain or Governor.'
                : submittedData?.isRestDay
                ? 'Your rest day has been logged and is pending validation.'
                : 'Your workout has been submitted and is pending validation by your team captain.'}
            </DialogDescription>
          </DialogHeader>

          {(submittedData?.rr_value || submittedData?.isRestDay) && (
            <div className="flex justify-center py-2">
              <div className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-full border",
                submittedData?.isExemption
                  ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20"
                  : "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20"
              )}>
                <span className={cn(
                  "text-2xl font-bold",
                  submittedData?.isExemption ? "text-amber-600" : "text-green-600"
                )}>
                  +{submittedData?.rr_value?.toFixed(1) || '1.0'}
                </span>
                <span className="text-sm text-muted-foreground">
                  RR points {submittedData?.isExemption && '(if approved)'}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
            <Button variant="outline" onClick={handleSubmitAnother} className="flex-1">
              <RotateCcw className="mr-2 size-4" />
              Submit Another
            </Button>
            <Button asChild className="flex-1">
              <Link href={`/leagues/${leagueId}/my-submissions`}>
                <Eye className="mr-2 size-4" />
                View Submissions
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
