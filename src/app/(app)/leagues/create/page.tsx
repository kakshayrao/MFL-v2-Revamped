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
  Check,
} from 'lucide-react';

import { useLeague } from '@/contexts/league-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  perDayRate?: number | null;
  perParticipantRate?: number | null;
  perDayTotal: number;
  perParticipantTotal: number;
  subtotal: number;
  gst: number;
  total: number;
}

type TierApiTier = {
  tier_id: string;
  tier_name: string;
  league_capacity?: number;
  league_days?: number;
  duration_days?: number;
  permitted_days?: number;
  pricing: {
    id: string;
    base_price: number;
    platform_fee: number;
    gst_percentage: number;
    per_day_rate?: number | null;
    per_participant_rate?: number | null;
  } | null;
  [key: string]: any;
};

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

  // Tier state
  const [tiers, setTiers] = React.useState<TierApiTier[]>([]);
  const [selectedTierId, setSelectedTierId] = React.useState<string | null>(null);

  // Form state
  const [formData, setFormData] = React.useState({
    league_name: '',
    description: '',
    num_teams: '4',
    total_players: '10',
    duration_days: '10',
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

  const getTierDaysPermitted = React.useCallback((tier: TierApiTier | null): number => {
    if (!tier) return 0;
    const raw =
      tier.league_days_permitted ??
      tier.days_permitted ??
      tier.league_days ??
      tier.duration_days ??
      tier.permitted_days;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, []);

  const computePricingTotals = React.useCallback(
    (tier: TierApiTier | null, duration: number, capacity: number): PricingData | null => {
      if (!tier?.pricing) return null;

      const p = tier.pricing;
      const base = Number(p.base_price) || 0;
      const platform = Number(p.platform_fee) || 0;
      const gstPct = Number(p.gst_percentage) || 0;
      const perDayRate = p.per_day_rate != null ? Number(p.per_day_rate) : null;
      const perParticipantRate = p.per_participant_rate != null ? Number(p.per_participant_rate) : null;

      const perDayTotal = perDayRate && duration > 0 ? perDayRate * duration : 0;
      const perParticipantTotal = perParticipantRate && capacity > 0 ? perParticipantRate * capacity : 0;

      const subtotal = base + platform + perDayTotal + perParticipantTotal;
      const gst = subtotal * (gstPct / 100);
      const total = subtotal + gst;

      return {
        basePrice: base,
        platformFee: platform,
        gstPercentage: gstPct,
        perDayRate,
        perParticipantRate,
        perDayTotal,
        perParticipantTotal,
        subtotal,
        gst,
        total,
      };
    },
    []
  );

  const startOfTodayLocal = React.useCallback(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Ensure start date is always set (mandatory) defaulting to today
  React.useEffect(() => {
    if (!startDate) {
      setStartDate(startOfTodayLocal());
    }
  }, [startDate, startOfTodayLocal]);

  const computeEndDate = React.useCallback((start: Date, totalDays: number): Date | null => {
    const days = Number(totalDays);
    if (!Number.isFinite(days) || days <= 0) return null;
    const end = new Date(start);
    // totalDays includes the start day
    end.setDate(end.getDate() + (days - 1));
    end.setHours(0, 0, 0, 0);
    return end;
  }, []);

  const selectedTier = React.useMemo(
    () => tiers.find((t) => t.tier_id === selectedTierId) || null,
    [tiers, selectedTierId]
  );

  const isCustomTier = React.useMemo(
    () => String(selectedTier?.tier_name ?? '').toLowerCase() === 'custom',
    [selectedTier?.tier_name]
  );

  const tierOptions = React.useMemo(() => {
    const byName = new Map(tiers.map((t) => [String(t.tier_name).toLowerCase(), t] as const));
    const ordered = ['basic', 'medium', 'pro', 'custom'];
    return ordered.map((name) => {
      const found = byName.get(name);
      return {
        key: name,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        tier: found ?? null,
      };
    });
  }, [tiers]);

  const getTierTotal = React.useCallback((tier: TierApiTier | null): number | null => {
    const duration = getTierDaysPermitted(tier);
    const capacity = Number(tier?.league_capacity) || 0;
    const totals = computePricingTotals(tier, duration, capacity);
    return totals ? totals.total : null;
  }, [computePricingTotals, getTierDaysPermitted]);

  const durationDays = React.useMemo(() => {
    const tierDays = getTierDaysPermitted(selectedTier);
    if (!isCustomTier) return tierDays;
    const n = parseInt(formData.duration_days, 10);
    if (Number.isFinite(n) && n > 0) return n;
    return tierDays;
  }, [formData.duration_days, selectedTier, getTierDaysPermitted, isCustomTier]);

  const effectiveStartDate = React.useMemo(() => startDate ?? startOfTodayLocal(), [startDate, startOfTodayLocal]);
  const computedEndDate = React.useMemo(
    () => computeEndDate(effectiveStartDate, durationDays),
    [effectiveStartDate, durationDays, computeEndDate]
  );

  // Fetch tiers + pricing on mount
  React.useEffect(() => {
    const fetchTiersAndPricing = async () => {
      try {
        const res = await fetch('/api/leagues/tiers');
        const json = await res.json();
        console.log('Tiers API response:', json);

        const list: TierApiTier[] =
          json?.success && Array.isArray(json?.data?.tiers) ? (json.data.tiers as TierApiTier[]) : [];
        
        // Ensure league_capacity + duration are set (fallback for tiers missing these values)
        const capacityByName: Record<string, number> = {
          basic: 10,
          medium: 30,
          pro: 60,
          custom: 100,
        };
        const durationByName: Record<string, number> = {
          basic: 10, // Basic is fixed 10 days
          medium: 30,
          pro: 90,
          custom: 30,
        };
        const enrichedList = list.map((t) => {
          const key = String(t.tier_name).toLowerCase();
          const fallbackCapacity = capacityByName[key] || 10;
          const fallbackDuration = durationByName[key];

          return {
            ...t,
            league_capacity: t.league_capacity || fallbackCapacity,
            duration_days:
              t.duration_days ?? t.league_days ?? t.permitted_days ?? t.league_days_permitted ?? fallbackDuration,
          };
        });
        
        console.log('Enriched tiers:', enrichedList);
        setTiers(enrichedList);

        // Default to basic (or first tier)
        const basic = list.find((t) => String(t.tier_name).toLowerCase() === 'basic');
        const initialTier = basic ?? list[0] ?? null;
        setSelectedTierId(initialTier?.tier_id ?? null);

        const initialDuration = getTierDaysPermitted(initialTier);
        const initialCapacity = Number(initialTier?.league_capacity) || 0;
        setPricing(computePricingTotals(initialTier, initialDuration, initialCapacity));
      } catch (err) {
        console.error('Failed to fetch tiers/pricing:', err);
      } finally {
        setPricingLoading(false);
      }
    };
    fetchTiersAndPricing();
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
    if (!selectedTierId) {
      setError('Please select a tier');
      return;
    }
    if (!computedEndDate) {
      setError('Tier configuration is missing league duration');
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
          start_date: format(effectiveStartDate, 'yyyy-MM-dd'),
          end_date: format(computedEndDate, 'yyyy-MM-dd'),
          tier_id: selectedTierId,
          num_teams: parseInt(formData.num_teams),
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
        body: JSON.stringify({
          leagueId,
          tierId: selectedTierId,
          durationDays,
          totalPlayers: tierCapacity,
        }),
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
      const message = err instanceof Error ? err.message : 'Failed to create league';
      if (message.includes('duplicate key value') || message.includes('already exists')) {
        setError('League name already exists. Please choose a different name.');
      } else {
        setError(message || 'Failed to create league');
      }
      setLoading(false);
    }
  };

  // Calculate league duration
  const duration =
    computedEndDate
      ? Math.ceil(
          (computedEndDate.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      : 0;

  const tierCapacity = React.useMemo(() => {
    const base = Number(selectedTier?.league_capacity) || 0;
    if (!isCustomTier) return base;
    const inputCapacity = parseInt(formData.total_players, 10);
    return Number.isFinite(inputCapacity) && inputCapacity > 0 ? inputCapacity : base;
  }, [formData.total_players, selectedTier?.league_capacity, isCustomTier]);

  // Update pricing when tier changes
  React.useEffect(() => {
    const totals = computePricingTotals(selectedTier, durationDays, tierCapacity);
    setPricing(totals);
  }, [selectedTier, computePricingTotals, durationDays, tierCapacity]);

  const totalMembers = tierCapacity;

  /**
   * Get valid team options based on tier capacity
   * Min = 2, Max = tier's league_capacity
   * Basic: 10, Medium: 30, Pro: 60
   */
  const getValidTeamOptions = React.useCallback((capacity: number): number[] => {
    const minTeams = 2;
    // Extended standard options to support up to 60 teams
    const standardOptions = [2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 30, 32, 40, 48, 50, 60];
    
    // If no tier selected yet, show options up to 10 (basic tier default)
    if (capacity <= 0) {
      return standardOptions.filter(n => n <= 10);
    }
    
    const maxTeams = capacity; // Max teams = tier capacity
    const options: number[] = [];
    
    for (const n of standardOptions) {
      if (n >= minTeams && n <= maxTeams) {
        options.push(n);
      }
    }
    
    // If no standard options fit, at least include minTeams
    if (options.length === 0) {
      options.push(minTeams);
    }
    
    return options;
  }, []);

  const teamOptions = React.useMemo(
    () => getValidTeamOptions(tierCapacity),
    [tierCapacity, getValidTeamOptions]
  );

  // Reset num_teams if current value exceeds tier capacity
  React.useEffect(() => {
    if (teamOptions.length === 0) return;
    const currentTeams = parseInt(formData.num_teams, 10);
    const maxAvailable = Math.max(...teamOptions);
    if (currentTeams > maxAvailable) {
      setFormData((prev) => ({
        ...prev,
        num_teams: maxAvailable.toString(),
      }));
    }
  }, [teamOptions, formData.num_teams]);

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
            {/* Tier Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  Choose Tier
                </CardTitle>
                <CardDescription>
                  Pick a plan for your league. Pricing and duration update automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {tierOptions.map(({ key, label, tier }) => {
                    const missing = !tier;
                    const value = missing ? `__missing_${key}` : tier.tier_id;
                    const total = getTierTotal(tier);
                    const isSelected = selectedTierId === value;
                    const capacity = tier?.league_capacity ?? 0;
                    const basePrice = tier?.pricing?.base_price ? Number(tier.pricing.base_price) : null;
                    const isCustomCard = key === 'custom';

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={missing}
                        onClick={() => {
                          if (!missing) setSelectedTierId(value);
                        }}
                        className={cn(
                          'relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200',
                          'hover:border-primary/50 hover:bg-primary/5',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                            : 'border-border bg-card',
                          missing && 'opacity-50 cursor-not-allowed hover:border-border hover:bg-card'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 size-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="size-3 text-primary-foreground" />
                          </div>
                        )}
                        <span className={cn(
                          'text-base font-semibold',
                          isSelected && 'text-primary'
                        )}>
                          {label}
                        </span>
                        <span className={cn(
                          'text-lg font-bold',
                          isSelected ? 'text-primary' : 'text-foreground'
                        )}>
                          {isCustomCard ? 'Get pricing' : basePrice != null ? `₹${Math.round(basePrice)}` : '—'}
                        </span>
                        {!isCustomCard && capacity > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Up to {capacity} players
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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
                  Choose a start date (required)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="leading-none">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            aria-label="Start date guidance"
                          >
                            <Info className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 text-sm" align="start">
                          Set your start date at least 2 days from today so you have time to set up teams and players before kickoff.
                        </PopoverContent>
                      </Popover>
                    </div>
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
                          {startDate ? format(startDate, 'PPP') : <span>Start today</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          disabled={(date) => date < startOfTodayLocal()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Total Players */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 leading-none">Total Players</Label>
                    {isCustomTier ? (
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g., 50"
                        value={formData.total_players}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, total_players: e.target.value }))
                        }
                      />
                    ) : (
                      <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm">
                        {tierCapacity > 0 ? `${tierCapacity} players` : '—'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm">
                      {computedEndDate ? format(computedEndDate, 'PPP') : '—'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 leading-none">Duration (days)</Label>
                    {isCustomTier ? (
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g., 30"
                        value={formData.duration_days}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, duration_days: e.target.value }))
                        }
                      />
                    ) : (
                      <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm">
                        {durationDays > 0 ? `${durationDays} days` : '—'}
                      </div>
                    )}
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
                        {teamOptions.map((n) => (
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
                      {tierCapacity} players
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
                    <span className="text-muted-foreground">Tier</span>
                    <span className="font-medium">
                      {selectedTier?.tier_name
                        ? String(selectedTier.tier_name).charAt(0).toUpperCase() + String(selectedTier.tier_name).slice(1)
                        : '—'}
                    </span>
                  </div>
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
                    <span className="font-medium">{tierCapacity} players</span>
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
                      <div className="flex justify-between text-muted-foreground">
                        <span className="opacity-70">Setup fee</span>
                        <span className="opacity-50">Included</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fee</span>
                        <span>₹{pricing.platformFee.toFixed(2)}</span>
                      </div>
                      {pricing.perDayTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Per-day ({pricing.perDayRate?.toFixed(2) ?? '0'}) × {durationDays} days
                          </span>
                          <span>₹{pricing.perDayTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {pricing.perParticipantTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Per-participant ({pricing.perParticipantRate?.toFixed(2) ?? '0'}) × {tierCapacity} players
                          </span>
                          <span>₹{pricing.perParticipantTotal.toFixed(2)}</span>
                        </div>
                      )}
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
