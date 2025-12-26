'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import Confetti from 'react-confetti';
import {
  Trophy,
  ArrowRight,
  Loader2,
  Calendar as CalendarIcon,
  Users,
  Lock,
  Globe,
  CreditCard,
  IndianRupee,
  CheckCircle2,
  ArrowLeft, 
  Sparkles,
  Info,
  PartyPopper,
  Share2,
  Crown,
  Plus,
} from 'lucide-react';

import { useLeague } from '@/contexts/league-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface PricingData {
  basePrice: number;
  platformFee: number;
  gstPercentage: number;
  subtotal: number;
  gst: number;
  total: number;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// ============================================================================
// Create League Page
// ============================================================================

export default function CreateLeaguePage() {
  const router = useRouter();
  const { refetch } = useLeague();

  const [step, setStep] = React.useState<'form' | 'payment' | 'success'>('form');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pricing, setPricing] = React.useState<PricingData | null>(null);
  const [pricingLoading, setPricingLoading] = React.useState(true);
  const [createdLeagueId, setCreatedLeagueId] = React.useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [windowSize, setWindowSize] = React.useState({ width: 0, height: 0 });

  // Date state
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();

  // Form state
  const [formData, setFormData] = React.useState({
    league_name: '',
    description: '',
    num_teams: '4',
    team_capacity: '5',
    rest_days: '1',
    is_public: false,
    is_exclusive: true,
  });

  // Window size for confetti
  React.useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  // Trigger confetti on success after 2 seconds
  React.useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        setShowConfetti(true);
        // Stop confetti after 5 seconds
        setTimeout(() => setShowConfetti(false), 5000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Fetch pricing on mount
  React.useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch('/api/leagues/pricing');
        const data = await res.json();
        if (data.pricing) {
          const { base_price, platform_fee, gst_percentage } = data.pricing;
          const subtotal = base_price + platform_fee;
          const gst = subtotal * (gst_percentage / 100);
          const total = subtotal + gst;
          setPricing({
            basePrice: base_price,
            platformFee: platform_fee,
            gstPercentage: gst_percentage,
            subtotal,
            gst,
            total,
          });
        }
      } catch (err) {
        console.error('Failed to fetch pricing:', err);
      } finally {
        setPricingLoading(false);
      }
    };
    fetchPricing();
  }, []);

  // Load Razorpay script
  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateLeague = async () => {
    // Validation
    if (!formData.league_name.trim()) {
      setError('Please enter a league name');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    if (endDate <= startDate) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create the league first (draft status)
      const createRes = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_name: formData.league_name.trim(),
          description: formData.description.trim() || null,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          num_teams: parseInt(formData.num_teams),
          team_capacity: parseInt(formData.team_capacity),
          rest_days: parseInt(formData.rest_days),
          is_public: formData.is_public,
          is_exclusive: formData.is_exclusive,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to create league');
      }

      const leagueId = createData.data?.league_id || createData.league_id;
      setCreatedLeagueId(leagueId);

      // Step 2: Create Razorpay order
      const orderRes = await fetch('/api/payments/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Step 3: Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'My Fitness League',
        description: `Payment for ${formData.league_name}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Step 4: Verify payment
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            // Success!
            setStep('success');
            await refetch();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Payment verification failed');
            setLoading(false);
          }
        },
        prefill: {},
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setError('Payment was cancelled');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create league');
      setLoading(false);
    }
  };

  // Calculate league duration
  const duration =
    startDate && endDate
      ? Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      : 0;

  const totalMembers =
    parseInt(formData.num_teams) * parseInt(formData.team_capacity);

  // Success State - Show Dialog with Confetti
  if (step === 'success') {
    return (
      <>
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={500}
            gravity={0.2}
            colors={['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']}
          />
        )}

        <Dialog open={true}>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-4">
                <div className="size-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center animate-bounce">
                  <PartyPopper className="size-10 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl">
                League Created!
              </DialogTitle>
              <DialogDescription className="text-base">
                <span className="font-semibold text-primary">{formData.league_name}</span> has been created successfully.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 py-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-center border">
                <p className="text-2xl font-bold text-primary">{formData.num_teams}</p>
                <p className="text-xs text-muted-foreground">Teams</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-center border">
                <p className="text-2xl font-bold text-primary">{totalMembers}</p>
                <p className="text-xs text-muted-foreground">Capacity</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-center border">
                <p className="text-2xl font-bold text-primary">{duration}</p>
                <p className="text-xs text-muted-foreground">Days</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="outline" asChild className="flex-1">
                <Link href="/leagues">
                  <Trophy className="mr-2 size-4" />
                  View All Leagues
                </Link>
              </Button>
              {createdLeagueId && (
                <Button asChild className="flex-1">
                  <Link href={`/leagues/${createdLeagueId}`}>
                    Open League
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Empty background while dialog is open */}
        <div className="flex flex-1 flex-col items-center justify-center p-4" />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="size-6 text-primary" />
              Create a League
            </h1>
            <p className="text-muted-foreground">
              Set up your fitness league and invite participants
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="size-5 text-primary" />
                  League Details
                </CardTitle>
                <CardDescription>
                  Basic information about your fitness league
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* League Name */}
                <div className="space-y-2">
                  <Label htmlFor="league_name">League Name *</Label>
                  <Input
                    id="league_name"
                    name="league_name"
                    placeholder="e.g., Summer Fitness Challenge 2025"
                    value={formData.league_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe your league goals, rules, and what participants can expect..."
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Schedule Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="size-5 text-primary" />
                  Schedule
                </CardTitle>
                <CardDescription>
                  Set the start and end dates for your league
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !startDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {startDate ? format(startDate, 'PPP') : <span>Pick start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <Label>End Date *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !endDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 size-4" />
                          {endDate ? format(endDate, 'PPP') : <span>Pick end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          disabled={(date) => date < (startDate || new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {duration > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm text-muted-foreground">
                      League duration:{' '}
                      <span className="font-semibold text-foreground">{duration} days</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="size-5 text-primary" />
                  Team Configuration
                </CardTitle>
                <CardDescription>
                  Configure the team structure for your league
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Number of Teams</Label>
                    <Select
                      value={formData.num_teams}
                      onValueChange={(v) => handleSelectChange('num_teams', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 8, 10, 12, 16, 20].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} teams
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rest Days/Week</Label>
                    <Select
                      value={formData.rest_days}
                      onValueChange={(v) => handleSelectChange('rest_days', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} {n === 1 ? 'day' : 'days'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">
                    Total capacity:{' '}
                    <span className="font-semibold text-foreground">
                      {totalMembers} members
                    </span>{' '}
                    across {formData.num_teams} teams
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Visibility Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Visibility & Access</CardTitle>
                <CardDescription>
                  Control who can see and join your league
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground" />
                      Public League
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Allow anyone to discover and view this league
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_public}
                    onCheckedChange={(checked) => handleSwitchChange('is_public', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Lock className="size-4 text-muted-foreground" />
                      Invite Only
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Only invited members can join the league
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_exclusive}
                    onCheckedChange={(checked) => handleSwitchChange('is_exclusive', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
                <CardDescription>Review your league settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">League Name</span>
                    <span className="font-medium truncate max-w-[150px]">
                      {formData.league_name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                      {duration > 0 ? `${duration} days` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teams</span>
                    <span className="font-medium">{formData.num_teams}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Capacity</span>
                    <span className="font-medium">{totalMembers}</span>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="size-4 text-primary" />
                    <span className="font-medium">Payment Details</span>
                  </div>
                  {pricingLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : pricing ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Price</span>
                        <span>₹{pricing.basePrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fee</span>
                        <span>₹{pricing.platformFee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GST ({pricing.gstPercentage}%)</span>
                        <span>₹{pricing.gst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t font-semibold text-base">
                        <span>Total</span>
                        <span className="text-primary flex items-center">
                          <IndianRupee className="size-4" />
                          {pricing.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Pricing not available
                    </p>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 space-y-3">
                  <Button
                    onClick={handleCreateLeague}
                    disabled={loading || !pricing}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="mr-2 size-4" />
                        Pay & Create League
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>

                {/* Info */}
                <div className="pt-4 border-t">
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <p>
                      Payment is required to create a league. You can modify settings
                      after creation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
