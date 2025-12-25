'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Calendar,
  Settings,
  BarChart3,
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
  team_size: number;
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
  const autoRestLast7GuardRef = React.useRef<Set<string>>(new Set());

  const [mySummary, setMySummary] = React.useState<{
    points: number;
    avgRR: number | null;
    restUsed: number;
    restUnused: number | null;
    missedDays: number;
    teamAvgRR: number | null;
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
          fetch(`/api/leagues/${id}/my-submissions?status=rejected`),
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
            const count =
              rejectedData?.success && rejectedData?.data
                ? Number(rejectedData.data?.stats?.total ?? rejectedData.data?.submissions?.length ?? 0)
                : 0;
            setRejectedCount(Number.isFinite(count) ? count : 0);
          } else {
            setRejectedCount(0);
          }
        }

        // Date-wise progress tracking (this week: Sunday → Saturday)
        try {
          const localYmd = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };

          const todayLocal = new Date();
          const todayStr = localYmd(todayLocal);

          // Show the current week (Sunday → Saturday) instead of a rolling 7-day window.
          const startLocal = new Date(todayLocal);
          startLocal.setDate(startLocal.getDate() - startLocal.getDay());
          const startDate = localYmd(startLocal);
          const endLocal = new Date(startLocal);
          endLocal.setDate(endLocal.getDate() + 6);
          const endDate = localYmd(endLocal);

          const tzOffsetMinutes = new Date().getTimezoneOffset();

          const recentUrl = `/api/leagues/${id}/my-submissions?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
          const recentRes = await fetch(recentUrl);

          if (recentRes.ok) {
            const recentData = await recentRes.json();
            let submissions: any[] =
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

            // Auto-assign missed past days as Rest Days until weekly allowance is exhausted.
            // Weeks run Sunday → Saturday.
            const weeklyAllowance = Number(leagueForTracking?.rest_days ?? 0);
            if (Number.isFinite(weeklyAllowance) && weeklyAllowance > 0) {
              const missingPastDates: string[] = [];

              // Collect missing dates across the last 7 days, but only for dates before today.
              for (let offset = 0; offset <= 6; offset += 1) {
                const d = new Date(startLocal);
                d.setDate(startLocal.getDate() + offset);
                const ymd = localYmd(d);
                if (ymd >= todayStr) continue;
                if (!byDate.has(ymd)) missingPastDates.push(ymd);
              }

              const guardKey = `${id}:${startDate}:${endDate}`;
              if (missingPastDates.length > 0 && !autoRestLast7GuardRef.current.has(guardKey)) {
                autoRestLast7GuardRef.current.add(guardKey);

                // Best-effort: let server enforce weekly caps.
                await fetch(`/api/leagues/${id}/auto-rest-days`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dates: missingPastDates, tzOffsetMinutes }),
                }).catch(() => null);

                // Re-fetch for accurate UI.
                const rerecent = await fetch(recentUrl).catch(() => null);
                if (rerecent && 'ok' in rerecent && rerecent.ok) {
                  const rerecentData = await rerecent.json();
                  submissions =
                    rerecentData?.success && rerecentData?.data?.submissions
                      ? (rerecentData.data.submissions as any[])
                      : submissions;

                  byDate.clear();
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
                }
              }
            }

            const rows: RecentDayRow[] = [];
            const leagueStart = typeof leagueForTracking?.start_date === 'string' ? leagueForTracking.start_date : null;
            const leagueEnd = typeof leagueForTracking?.end_date === 'string' ? leagueForTracking.end_date : null;

            for (let offset = 0; offset <= 6; offset += 1) {
              const d = new Date(startLocal);
              d.setDate(startLocal.getDate() + offset);
              const ymd = localYmd(d);
              const label = d.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              });

              const outOfRange =
                (leagueStart && ymd < leagueStart) ||
                (leagueEnd && ymd > leagueEnd);
              if (outOfRange) {
                rows.push({
                  date: ymd,
                  label,
                  subtitle: '—',
                  pointsLabel: '—',
                });
                continue;
              }

              const entry = byDate.get(ymd);
              if (!entry) {
                if (ymd > todayStr) {
                  rows.push({
                    date: ymd,
                    label,
                    subtitle: 'Upcoming',
                    pointsLabel: '—',
                  });
                  continue;
                }

                if (ymd === todayStr) {
                  rows.push({
                    date: ymd,
                    label,
                    subtitle: 'No submission yet',
                    pointsLabel: '—',
                  });
                  continue;
                }

                rows.push({
                  date: ymd,
                  label,
                  subtitle: 'Missed day',
                  pointsLabel: '0 pt',
                });
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

            setRecentDays(rows);
          } else {
            setRecentDays([]);
          }
        } catch {
          setRecentDays([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [id]);

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
          fetch(`/api/leagues/${id}/my-submissions?${qs.toString()}`),
          fetch(`/api/leagues/${id}/rest-days`),
        ]);

        let points = 0;
        let avgRR: number | null = null;
        let restUsed = 0;
        let missedDays = 0;
        let restUnused: number | null = null;
        let teamAvgRR: number | null = null;

        let teamId: string | null = null;

        if (myRes.ok) {
          const json = await myRes.json();
          const subs: Array<{ date: string; type: 'workout' | 'rest'; rr_value: number | null; status?: string | null }> =
            json?.success && json?.data?.submissions ? json.data.submissions : [];

          teamId = (json?.data?.teamId as string | null) ?? null;

          const isApproved = (s: { status?: string | null }) => {
            const v = String(s.status || '').toLowerCase();
            return v === 'approved' || v === 'accepted';
          };

          const approvedSubs = subs.filter((s) => isApproved(s));

          // Keep points/avgRR/restUsed aligned with "approved performance".
          points = approvedSubs.length;
          restUsed = approvedSubs.filter((s) => s.type === 'rest').length;

          const rrVals = approvedSubs
            .map((s) => (typeof s.rr_value === 'number' ? s.rr_value : null))
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
          avgRR = rrVals.length ? Math.round((rrVals.reduce((a, b) => a + b, 0) / rrVals.length) * 100) / 100 : null;

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
          const totalAllowed = typeof data?.totalAllowed === 'number' ? data.totalAllowed : null;
          if (typeof totalAllowed === 'number') {
            restUnused = Math.max(0, totalAllowed - restUsed);
          }
        }

        // Team Avg RR from leaderboard (best-effort, uses official leaderboard calculations).
        if (teamId) {
          try {
            const tzOffsetMinutes = new Date().getTimezoneOffset();
            const lbRes = await fetch(`/api/leagues/${id}/leaderboard?tzOffsetMinutes=${encodeURIComponent(String(tzOffsetMinutes))}`);
            if (lbRes.ok) {
              const lb = await lbRes.json();
              const teams: Array<{ team_id: string; avg_rr: number }> = lb?.data?.teams || lb?.data?.teamRankings || [];
              const mine = teams.find((t) => String(t.team_id) === String(teamId));
              const v = mine && typeof mine.avg_rr === 'number' ? mine.avg_rr : null;
              teamAvgRR = typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
            }
          } catch {
            // ignore
          }
        }

        setMySummary({ points, avgRR, restUsed, restUnused, missedDays, teamAvgRR });
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
          value: mySummary.points.toLocaleString(),
          changeLabel: 'Your score',
          description: 'Approved submissions',
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
          <Alert>
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
          <InviteDialog
            leagueId={league.league_id}
            leagueName={league.league_name}
            inviteCode={league.invite_code}
            memberCount={stats?.memberCount}
            maxCapacity={stats?.maxCapacity || (league.num_teams * league.team_size)}
          />
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
              <CardHeader>
                <CardTitle className="text-base">Avg RR — You vs Team</CardTitle>
                <CardDescription>Scale: 1.00 → 2.00</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const you = typeof mySummary.avgRR === 'number' ? mySummary.avgRR : null;
                  const team = typeof mySummary.teamAvgRR === 'number' ? mySummary.teamAvgRR : null;
                  const min = 1.0;
                  const max = 2.0;
                  const span = max - min;
                  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

                  const youPct = typeof you === 'number' ? pct(you) : null;
                  const teamPct = typeof team === 'number' ? pct(team) : null;

                  return (
                    <div>
                      <div className="relative h-2 rounded-full bg-muted">
                        {typeof youPct === 'number' ? (
                          <span className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${youPct}% - 4px)` }}>
                            <span className="block w-2 h-2 rounded-full bg-primary border border-background" />
                          </span>
                        ) : null}
                        {typeof teamPct === 'number' ? (
                          <span className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${teamPct}% - 4px)` }}>
                            <span className="block w-2 h-2 rounded-full bg-foreground/70 border border-background" />
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                          You: {typeof you === 'number' ? you.toFixed(2) : '—'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-foreground/70 inline-block" />
                          Team: {typeof team === 'number' ? team.toFixed(2) : '—'}
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold">This Week (Sun–Sat)</h2>
          <p className="text-sm text-muted-foreground">Week view resets every Sunday</p>
        </div>

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
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0">
            <div className="p-4 flex flex-col items-center text-center">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Users className="size-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{league.num_teams || 0}</p>
              <p className="text-xs text-muted-foreground">Teams</p>
            </div>
            <div className="p-4 flex flex-col items-center text-center">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Target className="size-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{league.team_size || 0}</p>
              <p className="text-xs text-muted-foreground">Per Team</p>
            </div>
            <div className="p-4 flex flex-col items-center text-center">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Medal className="size-5 text-primary" />
              </div>
              <p className="text-2xl font-bold tabular-nums">{(league.num_teams || 0) * (league.team_size || 0)}</p>
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
