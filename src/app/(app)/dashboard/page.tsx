'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Trophy,
  Users,
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Crown,
  Shield,
  Dumbbell,
  MoreVertical,
  ChevronRight,
  Calendar,
  Eye,
} from 'lucide-react';

import { useLeague, LeagueWithRoles } from '@/contexts/league-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================================
// Types
// ============================================================================

interface StatCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  description: string;
}

// ============================================================================
// Main Dashboard Page
// ============================================================================

export default function DashboardPage() {
  const { data: session } = useSession();
  const { userLeagues, isLoading, setActiveLeague } = useLeague();

  const userName = session?.user?.name?.split(' ')[0] || 'User';

  // Calculate stats
  const stats: StatCard[] = React.useMemo(() => {
    const activeLeagues = userLeagues.filter((l) => l.status === 'active').length;
    const hostingCount = userLeagues.filter((l) => l.is_host).length;
    const governorCount = userLeagues.filter((l) => l.roles.includes('governor')).length;
    const captainCount = userLeagues.filter((l) => l.roles.includes('captain')).length;

    return [
      {
        title: 'Total Leagues',
        value: userLeagues.length,
        changeLabel: 'Growing strong',
        description: 'Leagues you are a member of',
      },
      {
        title: 'Active Leagues',
        value: activeLeagues,
        changeLabel: activeLeagues > 0 ? 'In progress' : 'No active leagues',
        description: 'Currently running leagues',
      },
      {
        title: 'Hosting',
        value: hostingCount,
        changeLabel: hostingCount > 0 ? 'League creator' : 'Create your first',
        description: 'Leagues you created',
      },
      {
        title: 'Leadership Roles',
        value: governorCount + captainCount,
        changeLabel: 'Governor & Captain',
        description: 'Management positions held',
      },
    ];
  }, [userLeagues]);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {userName}!
          </h1>
          <p className="text-muted-foreground">
            {userLeagues.length > 0
              ? `You're part of ${userLeagues.length} league${userLeagues.length !== 1 ? 's' : ''}. Here's your overview.`
              : 'Get started by joining or creating a league to track your fitness journey.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/leagues/join">
              <Search className="mr-2 size-4" />
              Join League
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/leagues/create">
              <Plus className="mr-2 size-4" />
              Create League
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Section Cards */}
      {isLoading ? (
        <SectionCardsSkeleton />
      ) : (
        <SectionCards stats={stats} />
      )}

      {/* Leagues Table Section */}
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">My Leagues</h2>
            <p className="text-sm text-muted-foreground">
              All leagues you are a member of
            </p>
          </div>
          {userLeagues.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/leagues">
                View All
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          )}
        </div>

        {isLoading ? (
          <LeaguesTableSkeleton />
        ) : userLeagues.length === 0 ? (
          <LeaguesEmptyState />
        ) : (
          <LeaguesTable leagues={userLeagues} onSelect={setActiveLeague} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section Cards Component (Admin Style)
// ============================================================================

function SectionCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const isPositive = stat.change >= 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;

        return (
          <Card key={index} className="@container/card">
            <CardHeader>
              <CardDescription>{stat.title}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {stat.value}
              </CardTitle>
              <CardAction>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {stat.changeLabel} <TrendIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">{stat.description}</div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// Leagues Table Component (Admin Style)
// ============================================================================

function LeaguesTable({
  leagues,
  onSelect,
}: {
  leagues: LeagueWithRoles[];
  onSelect: (league: LeagueWithRoles) => void;
}) {
  const roleIcons: Record<string, React.ElementType> = {
    host: Crown,
    governor: Shield,
    captain: Users,
    player: Dumbbell,
  };

  const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'secondary',
    launched: 'outline',
    active: 'default',
    completed: 'secondary',
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>League</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Your Role</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leagues.map((league) => {
            // Get highest role
            const roleHierarchy = ['host', 'governor', 'captain', 'player'];
            const highestRole = roleHierarchy.find((r) =>
              league.roles.includes(r)
            ) || 'player';
            const RoleIcon = roleIcons[highestRole];

            return (
              <TableRow key={league.league_id}>
                <TableCell>
                  <Link
                    href={`/leagues/${league.league_id}`}
                    onClick={() => onSelect(league)}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="size-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{league.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {league.description || 'No description'}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[league.status] || 'secondary'}>
                    {league.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <RoleIcon className="size-4 text-muted-foreground" />
                    <span className="capitalize">{highestRole}</span>
                    {league.roles.length > 1 && (
                      <Badge variant="outline" className="text-xs">
                        +{league.roles.length - 1}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {league.team_name ? (
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      <span className="truncate max-w-[120px]">
                        {league.team_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                      >
                        <MoreVertical className="size-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/leagues/${league.league_id}`}
                          onClick={() => onSelect(league)}
                        >
                          <Eye className="mr-2 size-4" />
                          View League
                        </Link>
                      </DropdownMenuItem>
                      {league.is_host && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/leagues/${league.league_id}/settings`}>
                              Settings
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// Empty State Component (Using shadcn Empty)
// ============================================================================

function LeaguesEmptyState() {
  return (
    <Empty className="border rounded-lg">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Trophy />
        </EmptyMedia>
        <EmptyTitle>No leagues yet</EmptyTitle>
        <EmptyDescription>
          You haven't joined any leagues yet. Join an existing league or create
          your own to start your fitness journey with friends!
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/leagues/join">
              <Search className="mr-2 size-4" />
              Join a League
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/leagues/create">
              <Plus className="mr-2 size-4" />
              Create League
            </Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}

// ============================================================================
// Skeleton Components
// ============================================================================

function SectionCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16 mt-2" />
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function LeaguesTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead>League</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Your Role</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3].map((i) => (
            <TableRow key={i}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="size-8 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
