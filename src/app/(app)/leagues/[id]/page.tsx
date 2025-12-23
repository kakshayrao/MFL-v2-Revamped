'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Calendar,
  Settings,
  BarChart3,
  ClipboardCheck,
  Dumbbell,
  Crown,
  Shield,
  Target,
  Activity,
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
        const [leagueRes, statsRes] = await Promise.all([
          fetch(`/api/leagues/${id}`),
          fetch(`/api/leagues/${id}/stats`),
        ]);

        if (!leagueRes.ok) throw new Error('Failed to fetch league');

        const leagueData = await leagueRes.json();
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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load league');
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [id]);

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

  // Build stats from real data
  const leagueStats = [
    {
      title: 'Total Points',
      value: stats ? stats.totalPoints.toLocaleString() : '0',
      change: 0,
      changeLabel: 'Cumulative score',
      description: 'All approved submissions',
      icon: Zap,
    },
    {
      title: 'Active Members',
      value: stats ? `${stats.activeMembers}/${stats.memberCount}` : '0',
      change: stats && stats.memberCount > 0 ? Math.round((stats.activeMembers / stats.memberCount) * 100) : 0,
      changeLabel: 'Activity rate',
      description: 'Active in last 7 days',
      icon: Users,
    },
    {
      title: 'Submissions',
      value: stats ? stats.submissionCount.toLocaleString() : '0',
      change: stats?.pendingCount || 0,
      changeLabel: `${stats?.pendingCount || 0} pending`,
      description: 'Total activities logged',
      icon: ClipboardCheck,
    },
    {
      title: 'Daily Average',
      value: stats ? stats.dailyAverage.toFixed(1) : '0',
      change: 0,
      changeLabel: 'Last 30 days',
      description: 'Submissions per day',
      icon: Activity,
    },
  ];

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
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

      {/* Section Cards - Admin Dashboard Style */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {leagueStats.map((stat, index) => {
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
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {stat.changeLabel}
                </div>
                <div className="text-muted-foreground">{stat.description}</div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

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
              href={`/leagues/${id}/validate`}
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
                href={`/leagues/${id}/governors`}
                color="bg-gradient-to-br from-orange-500 to-red-600"
              />
            </>
          )}
        </div>
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
