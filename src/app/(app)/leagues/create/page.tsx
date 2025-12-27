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
import { TierConfig, PriceBreakdown, TierValidationResult } from '@/lib/services/tier-helpers';

// ============================================================================
// Types
// ============================================================================

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
  const [pricing, setPricing] = React.useState<PriceBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = React.useState(true);
  const [createdLeagueId, setCreatedLeagueId] = React.useState<string | null>(null);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [windowSize, setWindowSize] = React.useState({ width: 0, height: 0 });

  // Date state
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [duration, setDuration] = React.useState(30);
  const [endDate, setEndDate] = React.useState<Date | undefined>();

  // Tier state
  const [tiers, setTiers] = React.useState<TierConfig[]>([]);
  const [selectedTierId, setSelectedTierId] = React.useState<string | null>(null);
  
  // Price preview state
  const [pricePreview, setPricePreview] = React.useState<PriceBreakdown | null>(null);
  const [validation, setValidation] = React.useState<TierValidationResult | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState({
    league_name: '',
    description: '',
    num_teams: '4',
    max_participants: '20',
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

  const selectedTier = React.useMemo(
    () => tiers.find((t) => t.tier_id === selectedTierId) || null,
    [tiers, selectedTierId]
  );

  // Update end date when start date or duration changes
  React.useEffect(() => {
    if (startDate && duration > 0) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + duration - 1);
      end.setHours(0, 0, 0, 0);
      setEndDate(end);
    }
  }, [startDate, duration]);

  // Fetch tiers on mount
  React.useEffect(() => {
    const fetchTiers = async () => {
      try {
        const res = await fetch('/api/leagues/tiers');
        const json = await res.json();

        if (!res.ok || !json.success) {
          console.error('Failed to fetch tiers:', json.error);
          return;
        }

        const tierList: TierConfig[] = json.data?.tiers || [];
        setTiers(tierList);

        // Select first tier by default (sorted by display_order from API)
        if (tierList.length > 0 && !selectedTierId) {
          setSelectedTierId(tierList[0].tier_id);
          // Set default duration based on tier max
          const defaultDays = Math.min(30, tierList[0].max_days);
          setDuration(defaultDays);
          // Set default max participants
          setFormData(prev => ({
            ...prev,
            max_participants: tierList[0].max_participants.toString()
          }));
        }
      } catch (err) {
        console.error('Failed to fetch tiers:', err);
      } finally {
        setPricingLoading(false);
      }
    };
    fetchTiers();
  }, []);

  // Fetch price preview when tier, duration, or estimated participants change
  React.useEffect(() => {
    if (!selectedTierId || !duration) {
      setPricePreview(null);
      setValidation(null);
      return;
    }

    const estimatedParticipants = parseInt(formData.max_participants) || parseInt(formData.num_teams) * 5;

    const fetchPreview = async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch('/api/tiers/preview-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier_id: selectedTierId,
            duration_days: duration,
            estimated_participants: estimatedParticipants,
          }),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          setPricePreview(json.price_breakdown);
          setValidation(json.validation);
        } else {
          console.error('Price preview failed:', json.error);
          setPricePreview(null);
          setValidation(null);
        }
      } catch (err) {
        console.error('Price preview error:', err);
        setPricePreview(null);
        setValidation(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    // Debounce price preview requests
    const timeout = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timeout);
  }, [selectedTierId, duration, formData.num_teams, formData.max_participants]);

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
    if (!startDate || !endDate) {
      setError('Please select league dates');
      return;
    }
    if (validation && !validation.valid) {
      setError('Please fix validation errors before proceeding');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare league data for payment
      const leagueData = {
        league_name: formData.league_name.trim(),
        description: formData.description.trim() || null,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        tier_id: selectedTierId,
        num_teams: parseInt(formData.num_teams),
        max_participants: parseInt(formData.max_participants),
        rest_days: parseInt(formData.rest_days),
        is_public: formData.is_public,
        is_exclusive: formData.is_exclusive,
      };

      // Create Razorpay order with league data
      const orderRes = await fetch('/api/payments/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueData }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      // Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'My Fitness League',
        description: `Payment for ${formData.league_name}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment
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

            // Set league ID from verification response
            if (verifyData.payment?.league_id) {
              setCreatedLeagueId(verifyData.payment.league_id);
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

  const tierCapacity = parseInt(formData.max_participants) || Number(selectedTier?.max_participants) || 0;
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {tiers.map((tier) => {
                    const isSelected = selectedTierId === tier.tier_id;
                    const isFeatured = tier.is_featured;

                    return (
                      <button
                        key={tier.tier_id}
                        type="button"
                        onClick={() => {
                          setSelectedTierId(tier.tier_id);
                          // Update duration if current exceeds tier max
                          if (duration > tier.max_days) {
                            setDuration(tier.max_days);
                          }
                        }}
                        className={cn(
                          'relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                          'hover:border-primary/50 hover:bg-primary/5',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-md shadow-primary/20'
                            : 'border-border bg-card'
                        )}
                      >
                        {isFeatured && (
                          <Badge className="absolute -top-2 -right-2" variant="default">
                            Featured
                          </Badge>
                        )}
                        {isSelected && (
                          <div className="absolute -top-2 -left-2 size-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="size-3 text-primary-foreground" />
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1 w-full">
                          <span className={cn(
                            'text-base font-semibold',
                            isSelected && 'text-primary'
                          )}>
                            {tier.display_name}
                          </span>
                          
                          {tier.pricing.pricing_type === 'fixed' && tier.pricing.fixed_price && (
                            <span className={cn(
                              'text-lg font-bold',
                              isSelected ? 'text-primary' : 'text-foreground'
                            )}>
                              ₹{Math.round(tier.pricing.fixed_price)}
                            </span>
                          )}
                          
                          {tier.pricing.pricing_type === 'dynamic' && (
                            <span className="text-sm text-muted-foreground">
                              Custom pricing
                            </span>
                          )}
                          
                          <span className="text-xs text-muted-foreground">
                            Up to {tier.max_days} days
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tier.max_participants} participants
                          </span>
                        </div>

                        {tier.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {tier.description}
                          </p>
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
              <CardContent className="space-y-4">
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

                  {/* Duration Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="duration">
                      League Duration (days) *
                      {selectedTier && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Max: {selectedTier.max_days} days
                        </span>
                      )}
                    </Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      max={selectedTier?.max_days || 365}
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                      required
                    />
                    {validation && !validation.valid && validation.errors.some(e => e.includes('Duration')) && (
                      <p className="text-sm text-destructive">
                        {validation.errors.find(e => e.includes('Duration'))}
                      </p>
                    )}
                    {validation && validation.warnings.some(w => w.includes('Duration')) && (
                      <p className="text-sm text-yellow-600">
                        {validation.warnings.find(w => w.includes('Duration'))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm">
                      {endDate ? format(endDate, 'PPP') : '—'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Total Days</Label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm">
                      {duration > 0 ? `${duration} days` : '—'}
                    </div>
                  </div>
                </div>
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
                    <Label htmlFor="max_participants">
                      Max Participants *
                      {selectedTier && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Limit: {selectedTier.max_participants}
                        </span>
                      )}
                    </Label>
                    <Input
                      id="max_participants"
                      type="number"
                      min={parseInt(formData.num_teams) || 2}
                      max={selectedTier?.max_participants || 1000}
                      value={formData.max_participants}
                      onChange={handleChange}
                      name="max_participants"
                      required
                    />
                    {validation && !validation.valid && validation.errors.some(e => e.includes('Participants')) && (
                      <p className="text-sm text-destructive">
                        {validation.errors.find(e => e.includes('Participants'))}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
                  
                  <div className="space-y-2">
                    <Label>Avg Team Size</Label>
                    <div className="h-10 px-3 flex items-center rounded-md border bg-muted text-sm">
                      {Math.round(tierCapacity / parseInt(formData.num_teams))} players/team
                    </div>
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
                      {selectedTier?.display_name || '—'}
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

                <Separator />

                {/* Pricing Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="size-4 text-primary" />
                    <span className="font-medium">Payment Details</span>
                  </div>
                  {previewLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Calculating...</span>
                    </div>
                  ) : pricePreview ? (
                    <div className="space-y-2">
                      {pricePreview.pricing_type === 'dynamic' && pricePreview.breakdown_details && (
                        <div className="space-y-1 text-xs text-muted-foreground mb-2">
                          {pricePreview.breakdown_details.map((detail, idx) => (
                            <p key={idx}>{detail}</p>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>₹{pricePreview.subtotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>GST ({pricePreview.pricing_type === 'fixed' && selectedTier?.pricing.gst_percentage ? selectedTier.pricing.gst_percentage : 18}%):</span>
                        <span>₹{pricePreview.gst_amount.toFixed(2)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between text-base font-bold">
                        <span>Total:</span>
                        <span className="text-primary flex items-center">
                          <IndianRupee className="size-3 mr-0.5" />
                          {pricePreview.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select tier and duration to see pricing
                    </p>
                  )}
                </div>

                {validation && !validation.valid && (
                  <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                    <h4 className="text-sm font-semibold text-destructive mb-1">Validation Errors</h4>
                    <ul className="text-xs text-destructive space-y-1">
                      {validation.errors.map((error, idx) => (
                        <li key={idx}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validation && validation.valid && validation.warnings.length > 0 && (
                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200 dark:border-yellow-800">
                    <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Warnings</h4>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      {validation.warnings.map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
                    disabled={loading || !pricePreview || !validation?.valid}
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
