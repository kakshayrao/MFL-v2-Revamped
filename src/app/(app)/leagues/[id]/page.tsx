'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Calendar,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  Crown,
  Shield,
  Target,
  Flame,
  Globe,
  Lock,
  ArrowRight,
  Zap,
  Medal,
  Timer,
  TrendingUp
} from 'lucide-react';

import { useLeague } from '@/contexts/league-context';
import { useAuth } from '@/hooks/use-auth';
import { useRole } from '@/contexts/role-context';
import { Button } from '@/components/ui/button';
import { InviteDialog } from '@/components/league/invite-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function localYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalYmd(ymd: string): Date | null {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(String(ymd));
  if (!match) return null;
  const [y, m, d] = ymd.split('-').map((p) => Number(p));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function startOfWeekSunday(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function formatWeekRange(startLocal: Date) {
  const endLocal = addDays(startLocal, 6);
  const startText = startLocal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endText = endLocal.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} – ${endText}`;
}

// ============================================================================
// Types
// ============================================================================

interface LeagueDetails {
  league_id: string;
  league_name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: 'draft' | 'launched' | 'active' | 'completed';
  is_public: boolean;
  is_exclusive: boolean;
  num_teams: number;
  league_capacity: number;
  rest_days: number;
  invite_code: string | null;
}

interface LeagueStats {
  totalPoints: number;
  memberCount: number;
  teamCount: number;
  submissionCount: number;
  pendingCount: number;
  activeMembers: number;
  dailyAverage: number;
  maxCapacity: number;
}
type RecentDayRow = {
  date: string; // YYYY-MM-DD (local)
  label: string;
  subtitle: string;
  status?: string;
  pointsLabel: string;
};

// ============================================================================
// League Dashboard Page
// ============================================================================

export default function LeagueDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const { activeLeague, setActiveLeague, userLeagues } = useLeague();
  const { activeRole, isHost, isGovernor, isCaptain } = useRole();

  const [league, setLeague] = React.useState<LeagueDetails | null>(null);
  const [stats, setStats] = React.useState<LeagueStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rejectedCount, setRejectedCount] = React.useState<number>(0);
  const [recentDays, setRecentDays] = React.useState<RecentDayRow[] | null>(null);
  const [weekOffset, setWeekOffset] = React.useState(0);

  const { user } = useAuth();

  const [mySummary, setMySummary] = React.useState<{
    points: number; // approved workout points
    totalPoints: number; // includes challenge bonuses
    challengePoints: number; // difference (total - points)
    avgRR: number | null;
    restUsed: number;
    restUnused: number | null;
    missedDays: number;
    teamAvgRR: number | null;
    teamPoints: number | null;
  } | null>(null);

  // Sync active league if navigated directly
  React.useEffect(() => {
    if (userLeagues.length > 0 && (!activeLeague || activeLeague.league_id !== id)) {
      const matchingLeague = userLeagues.find((l) => l.league_id === id);
      if (matchingLeague) {
        setActiveLeague(matchingLeague);
      }
    }
  }, [id, userLeagues, activeLeague, setActiveLeague]);

  // Fetch league details and stats
  React.useEffect(() => {
    const fetchLeagueData = async () => {
      try {
        setLoading(true);

        // Fetch league details and stats in parallel
        const [leagueRes, statsRes, rejectedRes] = await Promise.all([
          fetch(`/api/leagues/${id}`),
          fetch(`/api/leagues/${id}/stats`),
          // Only need a count; endpoint returns stats alongside the list.
          fetch(`/api/leagues/${id}/my-submissions`),
        ]);

        if (!leagueRes.ok) throw new Error('Failed to fetch league');

        const leagueData = await leagueRes.json();
        const leagueForTracking: LeagueDetails | null =
          leagueData?.success && leagueData?.data ? (leagueData.data as LeagueDetails) : null;
        if (leagueData.success && leagueData.data) {
          setLeague(leagueData.data);
        } else {
          throw new Error('League not found');
        }

        // Stats are optional, don't fail if they can't be fetched
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.success && statsData.stats) {
            setStats(statsData.stats);
          }

          // Rejected reminder is best-effort: ignore auth/membership failures.
          if (rejectedRes.ok) {
            const rejectedData = await rejectedRes.json();
            if (rejectedData?.success && rejectedData?.data?.submissions) {
              const submissions: Array<{ date?: string; status?: string; created_date?: string; modified_date?: string }> = rejectedData.data.submissions;

              // For each date, pick the latest submission and count it only if it is still rejected.
              const latestByDate = new Map<string, { status: string; ts: string }>();
              submissions.forEach((s) => {
                if (!s?.date) return;
                const ts = (s.modified_date || s.created_date || '').toString();
                const existing = latestByDate.get(s.date);
                if (!existing || ts > existing.ts) {
                  latestByDate.set(s.date, { status: s.status || 'pending', ts });
                }
              });

              const rejectedDays = Array.from(latestByDate.values()).filter((v) => v.status === 'rejected').length;
              setRejectedCount(rejectedDays);
            } else {
              setRejectedCount(0);
            }
          } else {
            setRejectedCount(0);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [id]);

  // Week view (Sunday → Saturday) with navigation
  React.useEffect(() => {
    if (!league) return;

    let cancelled = false;
    setRecentDays(null);

    const run = async () => {
      try {
        const todayLocal = new Date();
        const todayStr = localYmd(todayLocal);

        const currentWeekStart = startOfWeekSunday(todayLocal);
        const weekStartLocal = addDays(currentWeekStart, -weekOffset * 7);
        const startDate = localYmd(weekStartLocal);
        const endDate = localYmd(addDays(weekStartLocal, 6));

        const recentUrl = `/api/leagues/${id}/my-submissions?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
        const recentRes = await fetch(recentUrl);
        if (!recentRes.ok) {
          if (!cancelled) setRecentDays([]);
          return;
        }

        const recentData = await recentRes.json();
        const submissions: any[] =
          recentData?.success && recentData?.data?.submissions ? (recentData.data.submissions as any[]) : [];

        const byDate = new Map<string, any>();
        for (const s of submissions) {
          if (!s?.date) continue;
          const existing = byDate.get(s.date);
          if (!existing) {
            byDate.set(s.date, s);
            continue;
          }
          const a = String(existing.created_date || existing.modified_date || '');
          const b = String(s.created_date || s.modified_date || '');
          if (b > a) byDate.set(s.date, s);
        }

        const rows: RecentDayRow[] = [];
        const leagueStart = typeof league.start_date === 'string' ? league.start_date : null;
        const leagueEnd = typeof league.end_date === 'string' ? league.end_date : null;

        for (let offset = 0; offset <= 6; offset += 1) {
          const d = addDays(weekStartLocal, offset);
          const ymd = localYmd(d);
          const label = d.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          });

          const outOfRange = (leagueStart && ymd < leagueStart) || (leagueEnd && ymd > leagueEnd);
          if (outOfRange) {
            rows.push({ date: ymd, label, subtitle: '—', pointsLabel: '—' });
            continue;
          }

          const entry = byDate.get(ymd);
          if (!entry) {
            if (ymd > todayStr) {
              rows.push({ date: ymd, label, subtitle: 'Upcoming', pointsLabel: '—' });
              continue;
            }

            if (ymd === todayStr) {
              rows.push({ date: ymd, label, subtitle: 'No submission yet', pointsLabel: '—' });
              continue;
            }

            rows.push({ date: ymd, label, subtitle: 'Missed day', pointsLabel: '0 pt' });
            continue;
          }

          const isWorkout = entry.type === 'workout';
          const workoutType = isWorkout && entry.workout_type ? String(entry.workout_type).replace(/_/g, ' ') : '';
          const typeLabel = isWorkout ? (workoutType ? workoutType : 'Workout') : 'Rest Day';
          const statusLabel = entry.status ? String(entry.status) : '';
          const subtitle = statusLabel ? `${typeLabel} • ${statusLabel}` : typeLabel;

          const rr = typeof entry.rr_value === 'number' ? entry.rr_value : null;
          const pointsLabel = rr === null ? '0 pt' : `${rr.toFixed(1)} RR`;

          rows.push({ date: ymd, label, subtitle, status: statusLabel, pointsLabel });
        }

        if (!cancelled) setRecentDays(rows);
      } catch {
        if (!cancelled) setRecentDays([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [id, league, weekOffset]);

  // Player summary (mirrors the metrics shown on /league-dashboard)
  React.useEffect(() => {
    if (!league) return;

    const localYmd = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const parseLocalYYYYMMDD = (ymd: string): Date | null => {
      const match = /^\d{4}-\d{2}-\d{2}$/.exec(String(ymd));
      if (!match) return null;
      const [y, m, d] = ymd.split('-').map((p) => Number(p));
      if (!y || !m || !d) return null;
      const dt = new Date(y, m - 1, d);
      if (Number.isNaN(dt.getTime())) return null;
      return dt;
    };

    const run = async () => {
      try {
        const todayLocal = new Date();
        const todayStr = localYmd(todayLocal);

        const leagueEndLocal = parseLocalYYYYMMDD(league.end_date);
        const effectiveEndStr = leagueEndLocal && localYmd(leagueEndLocal) < todayStr ? localYmd(leagueEndLocal) : todayStr;

        const qs = new URLSearchParams();
        qs.set('startDate', league.start_date);
        qs.set('endDate', effectiveEndStr);

        const [myRes, restRes] = await Promise.all([
          fetch(`/api/leagues/${id}/my-submissions?${qs.toString()}`, { credentials: 'include' }),
          fetch(`/api/leagues/${id}/rest-days`, { credentials: 'include' }),
        ]);

        let points = 0;
        let avgRR: number | null = null;
        let restUsed = 0;
        let missedDays = 0;
        let restUnused: number | null = null;
        let teamAvgRR: number | null = null;
        let teamPoints: number | null = null;

        let teamId: string | null = null;

        if (myRes.ok) {
          const json = await myRes.json();
          const subs: Array<{ date: string; type: string; rr_value: number | string | null; status?: string | null }> =
            json?.success && json?.data?.submissions ? json.data.submissions : [];

          // DEBUG: log what we're receiving from the API
          console.log('[MySummary] Raw submissions:', subs);
          console.log('[MySummary] Query range:', league.start_date, 'to', effectiveEndStr);

          teamId = (json?.data?.teamId as string | null) ?? null;

          const isApproved = (s: { status?: string | null }) => {
            const v = String(s.status || '').toLowerCase();
            return v === 'approved' || v === 'accepted';
          };

          const approvedSubs = subs.filter((s) => isApproved(s));
          console.log('[MySummary] Approved submissions:', approvedSubs);

          // User-facing definitions for the dashboard:
          // - Points: approved workouts count (1 point per approved workout)
          // - Avg RR: total approved RR divided by the number of approved workout-days (points)
          const approvedWorkouts = approvedSubs.filter((s) => String(s.type).toLowerCase() === 'workout');
          points = approvedWorkouts.length;
          restUsed = approvedSubs.filter((s) => String(s.type).toLowerCase() === 'rest').length;

          const totalRR = approvedWorkouts
            .map((s) => {
              const v = s.rr_value;
              if (typeof v === 'number') return v;
              if (typeof v === 'string') {
                const parsed = parseFloat(v);
                return Number.isFinite(parsed) ? parsed : 0;
              }
              return 0;
            })
            .filter((v) => Number.isFinite(v) && v > 0)
            .reduce((a, b) => a + b, 0);

          avgRR = points > 0 ? Math.round((totalRR / points) * 100) / 100 : null;

          // Missed days: from league start through yesterday (local), or league end if earlier.
          const startDt = parseLocalYYYYMMDD(league.start_date);
          const endDt = parseLocalYYYYMMDD(effectiveEndStr);
          if (startDt && endDt) {
            const yesterday = new Date(todayLocal);
            yesterday.setHours(0, 0, 0, 0);
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = localYmd(yesterday);
            const missedEndStr = localYmd(endDt) < yStr ? localYmd(endDt) : yStr;
            const missedEndDt = parseLocalYYYYMMDD(missedEndStr);

            if (missedEndDt && startDt.getTime() <= missedEndDt.getTime()) {
              // Missed days are days with no submission at all (any status).
              const byDate = new Set(subs.map((s) => String(s.date)));
              const cur = new Date(startDt);
              while (cur.getTime() <= missedEndDt.getTime()) {
                const ds = localYmd(cur);
                if (!byDate.has(ds)) missedDays += 1;
                cur.setDate(cur.getDate() + 1);
              }
            }
          }
        }

        if (restRes.ok) {
          const json = await restRes.json();
          const data = json?.data;
          const used = typeof data?.used === 'number' ? data.used : null;
          const remaining = typeof data?.remaining === 'number' ? data.remaining : null;
          const totalAllowed = typeof data?.totalAllowed === 'number' ? data.totalAllowed : null;

          // Prefer the dedicated rest-days endpoint for consistency.
          if (typeof used === 'number' && Number.isFinite(used)) {
            restUsed = Math.max(0, used);
          }
          if (typeof remaining === 'number' && Number.isFinite(remaining)) {
            restUnused = Math.max(0, remaining);
          } else if (typeof totalAllowed === 'number' && Number.isFinite(totalAllowed)) {
            restUnused = Math.max(0, totalAllowed - restUsed);
          }
        }

        // Team Avg RR from leaderboard (best-effort, uses official leaderboard calculations).
        let leaderboardData: any = null;
        if (teamId) {
          try {
            const tzOffsetMinutes = new Date().getTimezoneOffset();
            const lbRes = await fetch(
              `/api/leagues/${id}/leaderboard?tzOffsetMinutes=${encodeURIComponent(String(tzOffsetMinutes))}`,
              { credentials: 'include' }
            );
            if (lbRes.ok) {
              const lb = await lbRes.json();
              leaderboardData = lb;
              const teams: Array<{ team_id: string; avg_rr: number; points?: number; total_points?: number }> =
                lb?.data?.teams || lb?.data?.teamRankings || [];
              const mine = teams.find((t) => String(t.team_id) === String(teamId));
              const v = mine && typeof mine.avg_rr === 'number' ? mine.avg_rr : null;
              teamAvgRR = typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;

              const p =
                mine && typeof mine.points === 'number'
                  ? mine.points
                  : mine && typeof mine.total_points === 'number'
                    ? mine.total_points
                    : null;
              teamPoints = typeof p === 'number' && Number.isFinite(p) ? Math.max(0, p) : null;
            }
          } catch {
            // ignore
          }
        }

          // Also fetch leaderboard to find user's total points (includes challenge bonuses)
          try {
            const tzOffsetMinutes = new Date().getTimezoneOffset();
            // If we already fetched leaderboard for the team, reuse it.
            const lbRes = leaderboardData
              ? null
              : await fetch(
                  `/api/leagues/${id}/leaderboard?full=true&tzOffsetMinutes=${encodeURIComponent(String(tzOffsetMinutes))}`,
                  { credentials: 'include' }
                );

            const lbJson = lbRes ? (await lbRes.json()) : leaderboardData;
            const individuals: Array<{ user_id?: string; points?: number }> = lbJson?.data?.individuals || lbJson?.data?.individualRankings || [];
            let totalPoints = points;
            let challengePoints = 0;
            if (user && Array.isArray(individuals) && individuals.length > 0) {
              const mine = individuals.find((it) => String(it.user_id) === String(user.id));
              if (mine && typeof mine.points === 'number' && Number.isFinite(mine.points)) {
                totalPoints = Math.max(0, Math.round(mine.points));
                challengePoints = Math.max(0, totalPoints - points);
              }
            }

            // set totals with fallback to workout points
            setMySummary({ points, totalPoints, challengePoints, avgRR, restUsed, restUnused, missedDays, teamAvgRR, teamPoints });
          } catch (err) {
            // Fallback: no leaderboard available, use workout-only points
            setMySummary({ points, totalPoints: points, challengePoints: 0, avgRR, restUsed, restUnused, missedDays, teamAvgRR, teamPoints });
          }
          console.log('[MySummary] Final values:', { points, avgRR, restUsed, restUnused, missedDays, teamAvgRR, teamPoints });
      } catch {
        setMySummary(null);
      }
    };

    run();
  }, [id, league]);

  if (loading) {
    return <LeagueDashboardSkeleton />;
  }

  if (error || !league) {
    return (
      <div className="flex flex-col gap-6 py-4 md:py-6">
        <div className="px-4 lg:px-6">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-6 text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Trophy className="size-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">League Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || 'Unable to load league details'}
              </p>
              <Button asChild>
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate progress
  const today = new Date();
  const startDate = new Date(league.start_date);
  const endDate = new Date(league.end_date);
  const totalDays =
    Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.max(
    0,
    Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );
  const progressPercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    launched: { variant: 'outline', label: 'Launched' },
    active: { variant: 'default', label: 'Active' },
    completed: { variant: 'secondary', label: 'Completed' },
  };

  const mySummaryStats = mySummary
    ? [
        {
          title: 'Points',
          value: mySummary.totalPoints.toLocaleString(),
          changeLabel: 'Your score',
          description: `${mySummary.points.toLocaleString()} + ${mySummary.challengePoints.toLocaleString()} (workouts + challenges)`,
          icon: Zap,
        },
        {
          title: 'Avg RR',
          value: mySummary.avgRR !== null ? mySummary.avgRR.toFixed(2) : '—',
          changeLabel: 'Performance',
          description: 'Average RR (approved)',
          icon: TrendingUp,
        },
        {
          title: 'Rest Days Used',
          value: mySummary.restUsed.toLocaleString(),
          changeLabel: 'So far',
          description: 'Approved rest days',
          icon: Timer,
        },
        {
          title: 'Rest Days Unused',
          value: mySummary.restUnused !== null ? mySummary.restUnused.toLocaleString() : '—',
          changeLabel: 'Remaining',
          description: 'From league allowance',
          icon: Shield,
        },
        {
          title: 'Days Missed',
          value: mySummary.missedDays.toLocaleString(),
          changeLabel: 'Since start',
          description: 'No submission',
          icon: Flame,
        },
      ]
    : null;

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
      {rejectedCount > 0 && (
        <div className="px-4 lg:px-6">
          <Alert
            variant="destructive"
            className="border-destructive/50 bg-destructive/10"
          >
            <AlertTitle>Rejected workouts need attention</AlertTitle>
            <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                You have {rejectedCount} rejected submission{rejectedCount === 1 ? '' : 's'} in this league.
                Please review and resubmit.
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={`/leagues/${id}/my-submissions`}>View my submissions</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-lg">
            <Trophy className="size-7 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {league.league_name}
              </h1>
              <Badge variant={statusConfig[league.status]?.variant || 'secondary'}>
                {statusConfig[league.status]?.label || league.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {league.description || 'No description provided'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {isHost && (
            <InviteDialog
              leagueId={league.league_id}
              leagueName={league.league_name}
              inviteCode={league.invite_code}
              memberCount={stats?.memberCount}
              maxCapacity={stats?.maxCapacity || league.league_capacity}
            />
          )}
          {isHost && (
            <Button asChild size="sm">
              <Link href={`/leagues/${id}/settings`}>
                <Settings className="mr-2 size-4" />
                Settings
              </Link>
            </Button>
          )}
        </div>
      </div>

      {mySummaryStats ? (
        <>
          <div className="px-4 lg:px-6 mt-2">
            <h2 className="text-lg font-semibold">My Summary</h2>
            <p className="text-sm text-muted-foreground">Your approved performance in this league.</p>
          </div>
          <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
            {mySummaryStats.map((stat, index) => {
              const StatIcon = stat.icon;
              return (
                <Card key={index} className="@container/card">
                  <CardHeader>
                    <CardDescription className="flex items-center gap-2">
                      <StatIcon className="size-4" />
                      {stat.title}
                    </CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                      {stat.value}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline" className="text-muted-foreground">
                        <StatIcon className="size-3" />
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">{stat.changeLabel}</div>
                    <div className="text-muted-foreground">{stat.description}</div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <div className="px-4 lg:px-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle className="text-base">Avg RR — You vs Team</CardTitle>
                <span className="text-sm text-muted-foreground">Scale: 1.00 → 2.00</span>
              </CardHeader>
              <CardContent>
                {(() => {
                  const youPoints = typeof mySummary?.points === 'number' ? mySummary.points : null;
                  const you = typeof mySummary?.avgRR === 'number' ? mySummary.avgRR : null;
                  const team = typeof mySummary?.teamAvgRR === 'number' ? mySummary.teamAvgRR : null;
                  const teamPoints = typeof mySummary?.teamPoints === 'number' ? mySummary.teamPoints : null;
                  const min = 1.0;
                  const max = 2.0;
                  const span = max - min;
                  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

                  const youPct = typeof you === 'number' ? pct(you) : null;
                  const teamPct = typeof team === 'number' ? pct(team) : null;

                  const markerStyle = (p: number): React.CSSProperties => {
                    // Keep the dot fully inside the bar at 0%/100%.
                    const clamped = Math.max(0, Math.min(100, p));
                    const transform =
                      clamped <= 0
                        ? 'translate(0, -50%)'
                        : clamped >= 100
                          ? 'translate(-100%, -50%)'
                          : 'translate(-50%, -50%)';
                    return { left: `${clamped}%`, transform };
                  };

                  const youMarkerPct = typeof youPct === 'number' ? youPct : 0;
                  const teamMarkerPct = typeof teamPct === 'number' ? teamPct : 0;

                  return (
                    <div>
                      <div className="relative h-3 rounded-full bg-muted">
                        <span
                          className="absolute top-1/2"
                          style={markerStyle(youMarkerPct)}
                          aria-label="Your Avg RR"
                        >
                          <span
                            className={
                              typeof you === 'number'
                                ? 'block w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background'
                                : 'block w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border-2 border-background'
                            }
                          />
                        </span>

                        <span
                          className="absolute top-1/2"
                          style={markerStyle(teamMarkerPct)}
                          aria-label="Team Avg RR"
                        >
                          <span
                            className={
                              typeof team === 'number'
                                ? 'block w-2.5 h-2.5 rounded-full bg-primary border-2 border-background'
                                : 'block w-2.5 h-2.5 rounded-full bg-muted-foreground/40 border-2 border-background'
                            }
                          />
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mt-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-destructive inline-block" />
                          You:
                          <span className="text-foreground tabular-nums">
                            {typeof you === 'number' ? you.toFixed(2) : '—'}
                          </span>
                          {youPoints !== null ? (
                            <span className="tabular-nums">({youPoints.toLocaleString()} pt)</span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                          Team:
                          <span className="text-foreground tabular-nums">
                            {typeof team === 'number' ? team.toFixed(2) : '—'}
                          </span>
                          {teamPoints !== null ? (
                            <span className="tabular-nums">({teamPoints.toLocaleString()} pt)</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {/* Progress Bar (for launched/active leagues) */}
      {(league.status === 'active' || league.status === 'launched') && (
        <div className="px-4 lg:px-6">
          <Card className="bg-gradient-to-r from-primary/5 via-transparent to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame className="size-5 text-primary" />
                  <span className="font-medium">League Progress</span>
                </div>
                <Badge variant="outline" className="font-mono">
                  {progressPercent}% Complete
                </Badge>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="flex justify-between mt-3 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{daysElapsed}</span> days elapsed
                </span>
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{daysRemaining}</span> days remaining
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Quick Actions</h2>
            <p className="text-sm text-muted-foreground">Navigate to common tasks</p>
          </div>
          <Badge variant="outline" className="w-fit">
            <Crown className="size-3 mr-1" />
            Role: {activeRole || 'Player'}
          </Badge>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Player Actions */}
          <QuickActionCard
            title="Submit Activity"
            description="Log your workout and earn points"
            icon={Dumbbell}
            href={`/leagues/${id}/submit`}
            color="bg-gradient-to-br from-green-500 to-emerald-600"
          />
          <QuickActionCard
            title="Leaderboard"
            description="Team and individual rankings"
            icon={BarChart3}
            href={`/leagues/${id}/leaderboard`}
            color="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          <QuickActionCard
            title="My Team"
            description="View team members and stats"
            icon={Users}
            href={`/leagues/${id}/team`}
            color="bg-gradient-to-br from-purple-500 to-violet-600"
          />

          {/* Captain+ Actions */}
          {isCaptain && (
            <QuickActionCard
              title="Validate Submissions"
              description="Review and approve activities"
              icon={Shield}
              href={`/leagues/${id}/my-team/submissions`}
              color="bg-gradient-to-br from-amber-500 to-orange-600"
            />
          )}

          {/* Governor+ Actions */}
          {isGovernor && (
            <>
              <QuickActionCard
                title="All Submissions"
                description="View league-wide submissions"
                icon={ClipboardCheck}
                href={`/leagues/${id}/submissions`}
                color="bg-gradient-to-br from-indigo-500 to-purple-600"
              />
              <QuickActionCard
                title="Manage Members"
                description="Add, remove, or transfer members"
                icon={Users}
                href={`/leagues/${id}/members`}
                color="bg-gradient-to-br from-pink-500 to-rose-600"
              />
            </>
          )}

          {/* Host Actions */}
          {isHost && (
            <>
              <QuickActionCard
                title="Analytics"
                description="Performance metrics and insights"
                icon={TrendingUp}
                href={`/leagues/${id}/analytics`}
                color="bg-gradient-to-br from-cyan-500 to-teal-600"
              />
              <QuickActionCard
                title="Manage Governors"
                description="Assign or revoke governor access"
                icon={Crown}
                href={`/leagues/${id}/team`}
                color="bg-gradient-to-br from-orange-500 to-red-600"
              />
            </>
          )}
        </div>
      </div>

      {/* Date-wise Progress (This Week: Sun–Sat) */}
      <div className="px-4 lg:px-6">
        {(() => {
          const currentWeekStart = startOfWeekSunday(new Date());
          const weekStartLocal = addDays(currentWeekStart, -weekOffset * 7);

          const leagueStartLocal = league?.start_date ? parseLocalYmd(league.start_date) : null;
          const leagueStartWeek = leagueStartLocal ? startOfWeekSunday(leagueStartLocal) : null;
          const maxWeekOffset = leagueStartWeek
            ? Math.max(0, Math.floor((currentWeekStart.getTime() - leagueStartWeek.getTime()) / (7 * MS_PER_DAY)))
            : Infinity;

          const canGoPrev = Number.isFinite(maxWeekOffset) ? weekOffset < maxWeekOffset : true;
          const canGoNext = weekOffset > 0;

          return (
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">This Week (Sun–Sat)</h2>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setWeekOffset((w) => (canGoPrev ? w + 1 : w))}
                      disabled={!canGoPrev}
                      aria-label="Previous week"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setWeekOffset((w) => (canGoNext ? Math.max(0, w - 1) : w))}
                      disabled={!canGoNext}
                      aria-label="Next week"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {formatWeekRange(weekStartLocal)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Week view resets every Sunday</p>
              </div>
            </div>
          );
        })()}

        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentDays === null ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
              ) : recentDays.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">No recent activity.</div>
              ) : (
                recentDays.map((row) => (
                  <div key={row.date} className="flex items-center justify-between px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{row.label}</span>
                      {(() => {
                        const rawStatus = typeof row.status === 'string' ? row.status.trim() : '';
                        const normalized = rawStatus.toLowerCase();
                        const statusColor =
                          normalized === 'approved' || normalized === 'accepted'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : normalized === 'pending'
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : normalized === 'rejected'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground';

                        if (!rawStatus || !row.subtitle.includes('•')) {
                          return <span className="text-sm text-muted-foreground">{row.subtitle}</span>;
                        }

                        const [left] = row.subtitle.split('•');
                        const leftText = left ? left.trim() : '';
                        const statusText = rawStatus;

                        return (
                          <span className="text-sm text-muted-foreground">
                            {leftText}
                            <span className="text-muted-foreground"> {'•'} </span>
                            <span className={statusColor}>{statusText}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <div className="font-medium tabular-nums">{row.pointsLabel}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* League Information - Table Style */}
      <div className="px-4 lg:px-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">League Information</h2>
          <p className="text-sm text-muted-foreground">Configuration and settings overview</p>
        </div>

        <div className="rounded-lg border">
          <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y md:divide-y-0">
            <div className="p-4 flex flex-col items-center text-center">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Users className="size-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{league.num_teams || 0}</p>
              <p className="text-xs text-muted-foreground">Teams</p>
            </div>
            <div className="p-4 flex flex-col items-center text-center">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Medal className="size-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{league.league_capacity || 0}</p>
              <p className="text-xs text-muted-foreground">Max Capacity</p>
            </div>
            <div className="p-4 flex flex-col items-center text-center">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Timer className="size-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{totalDays}</p>
              <p className="text-xs text-muted-foreground">Days Total</p>
            </div>
          </div>

          <div className="border-t p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 md:flex-col md:items-start">
                <span className="text-sm text-muted-foreground">Visibility</span>
                <Badge variant={league.is_public ? 'default' : 'secondary'}>
                  {league.is_public ? (
                    <><Globe className="size-3 mr-1" />Public</>
                  ) : (
                    <><Lock className="size-3 mr-1" />Private</>
                  )}
                </Badge>
              </div>
              <div className="flex flex-col gap-1 md:flex-col md:items-start">

                <span className="text-sm text-muted-foreground">Join Type</span>
                <Badge variant="outline">
                  {league.is_exclusive ? 'Invite Only' : 'Open'}
                </Badge>
              </div>
              <div className="flex flex-col gap-1 md:flex-col md:items-start">

                <span className="text-sm text-muted-foreground">Rest Days</span>
                <Badge variant="outline">
                  {league.rest_days} per week
                </Badge>
              </div>
              <div className="flex flex-col gap-1 md:flex-col md:items-start">

                <span className="text-sm text-muted-foreground">Schedule</span>
                <Badge variant="outline" className="text-xs">
                  <Calendar className="size-3 mr-1" />
                  {formatDate(league.start_date)} - {formatDate(league.end_date)}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Action Card Component
// ============================================================================

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full hover:shadow-md transition-all hover:border-primary/30 cursor-pointer group">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`size-12 rounded-xl ${color} flex items-center justify-center shadow-lg`}>
            <Icon className="size-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          </div>
          <ArrowRight className="size-5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

function LeagueDashboardSkeleton() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Section Cards Skeleton */}
      <div className="grid gap-4 grid-cols-1 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Progress Skeleton */}
      <div className="px-4 lg:px-6">
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>

      {/* Quick Actions Skeleton */}
      <div className="px-4 lg:px-6">
        <div className="mb-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* League Info Skeleton */}
      <div className="px-4 lg:px-6">
        <div className="mb-4">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
