'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Save,
  Trash2,
  AlertTriangle,
  Loader2,
  Globe,
  Lock,
  Users,
  Trophy,
  Info,
  Shield,
  Calendar,
} from 'lucide-react';

import { useRole } from '@/contexts/role-context';
import { useLeague } from '@/contexts/league-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

// ============================================================================
// League Settings Page (Host Only)
// ============================================================================

export default function LeagueSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { isHost } = useRole();
  const { activeLeague, refetch } = useLeague();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    league_name: activeLeague?.name || '',
    description: activeLeague?.description || '',
    is_public: false,
    is_exclusive: true,
    num_teams: '4',
    rest_days: '1',
    auto_rest_day_enabled: false,
    start_date: '',
    end_date: '',
    status: 'draft' as 'draft' | 'launched' | 'active' | 'completed',
    normalize_points_by_team_size: false,
  });

  const canEditStructure = formData.status === 'draft';

  useEffect(() => {
    const loadLeague = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const res = await fetch(`/api/leagues/${id}`);
        if (!res.ok) {
          throw new Error('Failed to load league');
        }

        const json = await res.json();
        const league = json.data;

        setFormData({
          league_name: league.league_name || '',
          description: league.description || '',
          is_public: !!league.is_public,
          is_exclusive: !!league.is_exclusive,
          num_teams: String(league.num_teams || '4'),
          rest_days: String(league.rest_days ?? '1'),
          auto_rest_day_enabled: !!league.auto_rest_day_enabled,
          start_date: league.start_date,
          end_date: league.end_date,
          status: league.status,
          normalize_points_by_team_size: !!league.normalize_points_by_team_size,
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };

    loadLeague();
  }, [id]);

  // Access check
  if (!isHost) {
    return (
      <div className="flex flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Shield className="size-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground mb-4">
                Only the league host can access settings.
              </p>
              <Button variant="outline" onClick={() => router.back()}>
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center space-y-3">
              <Loader2 className="size-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading league settings...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertTriangle className="size-10 text-destructive mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Unable to load league</h2>
                <p className="text-muted-foreground">{loadError}</p>
              </div>
              <Button variant="outline" onClick={() => router.refresh()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const payload: Record<string, string | number | boolean> = {
        rest_days: Number(formData.rest_days),
        auto_rest_day_enabled: formData.auto_rest_day_enabled,
        description: formData.description,
        normalize_points_by_team_size: formData.normalize_points_by_team_size,
      };

      if (canEditStructure) {
        Object.assign(payload, {
          league_name: formData.league_name,
          is_public: formData.is_public,
          is_exclusive: formData.is_exclusive,
          num_teams: Number(formData.num_teams),
          start_date: formData.start_date,
          end_date: formData.end_date,
        });
      }

      const res = await fetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to save changes');
      }

      const json = await res.json();
      if (json?.data) {
        const league = json.data;
        setFormData((prev) => ({
          ...prev,
          league_name: league.league_name || prev.league_name,
          description: league.description || '',
          is_public: !!league.is_public,
          is_exclusive: !!league.is_exclusive,
          num_teams: String(league.num_teams || prev.num_teams),
          rest_days: String(league.rest_days ?? prev.rest_days),
          auto_rest_day_enabled: !!league.auto_rest_day_enabled,
          start_date: league.start_date,
          end_date: league.end_date,
          status: league.status,
        }));
      }

      await refetch();

      // Show toast for normalization status
      if (payload.normalize_points_by_team_size !== undefined) {
        const status = payload.normalize_points_by_team_size ? 'enabled' : 'disabled';
        toast.success(`Point normalization ${status}.`);
      } else {
        toast.success('League settings updated.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/leagues/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to delete league');
      }

      await refetch();
      router.push('/dashboard');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to delete league');
    } finally {
      setDeleting(false);
    }
  };

  // Note: totalMembers calculation removed - capacity now comes from tier

  return (
    <div className="flex flex-col gap-6 py-4 md:py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Settings className="size-6 text-primary" />
              League Settings
            </h1>
            <p className="text-muted-foreground">
              Configure your league settings and preferences
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="w-fit">
              League ID: {id.slice(0, 8)}...
            </Badge>
            <Badge variant={formData.status === 'active' ? 'default' : 'secondary'} className="capitalize">
              {formData.status}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Calendar className="size-3" />
              {formData.start_date || '—'} → {formData.end_date || '—'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Settings Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="size-5 text-primary" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Update your league details and description
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="league_name">League Name</Label>
                  <Input
                    id="league_name"
                    value={formData.league_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        league_name: e.target.value,
                      }))
                    }
                    placeholder="Enter league name"
                    disabled={!canEditStructure}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Describe your league goals and rules..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      disabled={!canEditStructure}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      disabled={!canEditStructure}
                    />
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
                  Configure team settings (changes may not apply to active
                  leagues)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Number of Teams</Label>
                    <Select
                      value={formData.num_teams}
                      onValueChange={(v) =>
                        setFormData((prev) => ({ ...prev, num_teams: v }))
                      }
                      disabled={!canEditStructure}
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
                      onValueChange={(v) =>
                        setFormData((prev) => ({ ...prev, rest_days: v }))
                      }
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
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">
                      Capacity is determined by your league tier.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rest day changes apply immediately, even for active leagues.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rest Day Automation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="size-5 text-primary" />
                  Rest Day Automation
                </CardTitle>
                <CardDescription>
                  Auto-assign a rest day if a member misses the daily deadline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">Auto Rest Day</Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, the cron job assigns a rest day for members with remaining rest days and no submission for the previous day.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">💾 Click "Save Changes" to apply</p>
                  </div>
                  <Switch
                    checked={formData.auto_rest_day_enabled}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, auto_rest_day_enabled: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Point Normalization */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="size-5 text-primary" />
                  Point Normalization
                </CardTitle>
                <CardDescription>
                  Normalize team points based on team size for fair competition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">Normalize Points by Team Size</Label>
                    <p className="text-sm text-muted-foreground">
                      When enabled, team points are normalized using the formula: (raw_points / team_size) × max_team_size
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">💾 Click "Save Changes" to apply</p>
                  </div>
                  <Switch
                    checked={formData.normalize_points_by_team_size}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, normalize_points_by_team_size: checked }))
                    }
                  />
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
                      Allow anyone to discover this league
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">💾 Click "Save Changes" to apply</p>
                  </div>
                  <Switch
                    checked={formData.is_public}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_public: checked }))
                    }
                    disabled={!canEditStructure}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Lock className="size-4 text-muted-foreground" />
                      Invite Only
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Require invite code to join
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">💾 Click "Save Changes" to apply</p>
                  </div>
                  <Switch
                    checked={formData.is_exclusive}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, is_exclusive: checked }))
                    }
                    disabled={!canEditStructure}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone Card */}
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions. Proceed with caution.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto">
                      <Trash2 className="mr-2 size-4" />
                      Delete League
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the league and remove all associated data
                        including teams, members, and submissions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          'Delete League'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary Sidebar */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Settings Summary</CardTitle>
                <CardDescription>Review your changes</CardDescription>
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
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{formData.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schedule</span>
                    <span className="font-medium text-right">
                      {formData.start_date || '—'} → {formData.end_date || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teams</span>
                    <span className="font-medium">{formData.num_teams}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rest Days/Week</span>
                    <span className="font-medium">{formData.rest_days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto Rest Day</span>
                    <span className="font-medium">{formData.auto_rest_day_enabled ? 'On' : 'Off'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Point Normalization</span>
                    <span className="font-medium">{formData.normalize_points_by_team_size ? 'On' : 'Off'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Capacity</span>
                    <span className="font-medium text-xs">(from tier)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Visibility</span>
                    <span className="font-medium">
                      {formData.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Join Type</span>
                    <span className="font-medium">
                      {formData.is_exclusive ? 'Invite Only' : 'Open'}
                    </span>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 size-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  {saveError && (
                    <p className="text-sm text-destructive mt-2">{saveError}</p>
                  )}
                </div>

                {/* Info */}
                <div className="pt-4 border-t">
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <p>
                      Some settings may not take effect immediately for active
                      leagues.
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
