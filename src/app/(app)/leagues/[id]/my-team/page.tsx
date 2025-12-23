/**
 * My Team Page (Captain)
 * Captain's view for managing their team - members and team info.
 */
'use client';

import { use, useState, useEffect, useMemo } from 'react';
import {
  Users,
  Trophy,
  Target,
  Crown,
  Shield,
  Flame,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  UserMinus,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLeague } from '@/contexts/league-context';
import { useRole } from '@/contexts/role-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import type { TeamMember } from '@/hooks/use-league-teams';

// ============================================================================
// Loading Skeleton
// ============================================================================

function PageSkeleton() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Captain's My Team Page
// ============================================================================

export default function MyTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = use(params);
  const { activeLeague } = useLeague();
  const { isCaptain } = useRole();

  console.debug('[MyTeamPage] render', { leagueId, activeLeague });

  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamRank, setTeamRank] = useState<string>('#--');
  const [teamPoints, setTeamPoints] = useState<string>('--');
  const [teamAvgRR, setTeamAvgRR] = useState<string>('--');
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const userTeamId = activeLeague?.team_id;
  const userTeamName = activeLeague?.team_name;
  const teamSize = activeLeague?.team_size || 5;

  // Fetch team members
  useEffect(() => {
    async function fetchMembers() {
      if (!userTeamId) {
        setIsLoading(false);
        return;
      }

      console.debug('[MyTeamPage] fetchMembers start', { leagueId, userTeamId });

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/leagues/${leagueId}/teams/${userTeamId}/members`
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch team members');
        }

        if (result.success) {
          // Map members and attach default points
          let membersWithPoints = (result.data || []).map((m: any) => ({ ...m, points: 0 }));

          // Try to fetch full leaderboard to get individual points
          try {
            const lbRes = await fetch(`/api/leagues/${leagueId}/leaderboard?full=true`);
            const lbJson = await lbRes.json();
            if (lbRes.ok && lbJson?.success && lbJson.data?.individuals) {
              console.debug('[MyTeamPage] leaderboard individuals count:', lbJson.data.individuals.length);
              console.debug('[MyTeamPage] sample individuals:', lbJson.data.individuals.slice(0,5));
              const pts = new Map<string, number>(
                lbJson.data.individuals.map((i: any) => [String(i.user_id), Number(i.points || 0)])
              );
              console.debug('[MyTeamPage] built points map size:', pts.size);
              membersWithPoints = membersWithPoints.map((m: any) => ({ ...m, points: pts.get(String(m.user_id)) || 0 }));
            }
          } catch (err) {
            console.error('Error fetching leaderboard for points:', err);
          }

          setMembers(membersWithPoints);

          // Also attempt to fetch leaderboard stats now that we have team id
          try {
            console.debug('[MyTeamPage] fetching leaderboard from fetchMembers');
            const res2 = await fetch(`/api/leagues/${leagueId}/leaderboard`);
            const json2 = await res2.json();
            console.debug('[MyTeamPage] leaderboard from fetchMembers ok:', res2.ok, 'status:', res2.status, 'keys:', Object.keys(json2 || {}));
            if (!res2.ok) {
              setLeaderboardError(`Leaderboard request failed: ${res2.status}`);
            } else {
              setLeaderboardError(null);
            }
            if (res2.ok && json2?.success && json2.data?.teams) {
              const teams2: any[] = json2.data.teams || [];
              const team2 = teams2.find((t) => String(t.team_id) === String(userTeamId));
              console.debug('[MyTeamPage] matched team (from fetchMembers):', team2);
              if (team2) {
                setTeamRank(`#${team2.rank ?? '--'}`);
                const pts2 = team2.total_points ?? team2.points ?? 0;
                setTeamPoints(String(pts2));
                setTeamAvgRR(String(team2.avg_rr ?? 0));
              }
            }
          } catch (err) {
            console.error('Error fetching leaderboard inside fetchMembers:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching team members:', err);
        setError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMembers();
  }, [leagueId, userTeamId]);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    return members.filter(
      (member) =>
        member.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, members]);

  // Pagination
  const paginatedMembers = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return filteredMembers.slice(start, start + pagination.pageSize);
  }, [filteredMembers, pagination]);

  const pageCount = Math.ceil(filteredMembers.length / pagination.pageSize);

  // Get captain info
  const captain = members.find((m) => m.is_captain);

  // Stats cards data
  const stats = [
    {
      title: 'Team Rank',
      value: teamRank,
      description: 'League standing',
      detail: 'Rank updates daily',
      icon: Trophy,
    },
    {
      title: 'Team Members',
      value: `${members.length}/${teamSize}`,
      description: 'Current roster',
      detail: 'Active members',
      icon: Users,
    },
    {
      title: 'Team Points',
      value: String(teamPoints),
      description: 'Total RR',
      detail: 'Combined team effort',
      icon: Target,
    },
    {
      title: 'Team RR',
      value: String(teamAvgRR),
      description: 'Average RR',
      detail: 'Average RR per approved entry',
      icon: Flame,
    },
  ];

  // Fetch leaderboard to populate team rank/points/avg rr
  useEffect(() => {
    async function fetchLeaderboardStats() {
      if (!leagueId || !userTeamId) return;
      try {
        console.debug('[MyTeamPage] fetchLeaderboardStats start', { leagueId, userTeamId });
        const res = await fetch(`/api/leagues/${leagueId}/leaderboard`);
        const json = await res.json();
        console.debug('[MyTeamPage] leaderboard response ok:', res.ok, 'status:', res.status, 'body keys:', Object.keys(json || {}));
        console.debug('[MyTeamPage] leaderboard teams length:', json?.data?.teams?.length ?? 0);
        if (!res.ok) {
          setLeaderboardError(`Leaderboard request failed: ${res.status}`);
        } else {
          setLeaderboardError(null);
        }
        if (res.ok && json?.success && json.data?.teams) {
          const teams: any[] = json.data.teams || [];
          const team = teams.find((t) => String(t.team_id) === String(userTeamId));
          console.debug('[MyTeamPage] matched team:', team);
          if (team) {
            setTeamRank(`#${team.rank ?? '--'}`);
            // team.total_points is preferred
            const pts = team.total_points ?? team.points ?? 0;
            setTeamPoints(String(pts));
            setTeamAvgRR(String(team.avg_rr ?? 0));
          }
        }
      } catch (err) {
        console.error('Error fetching leaderboard stats for team:', err);
      }
    }

    fetchLeaderboardStats();
  }, [leagueId, userTeamId]);

  // Check if user is captain
  if (!isCaptain) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              This page is only accessible to team captains. If you believe
              you should have access, please contact your league administrator.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // User not assigned to a team
  if (!userTeamId || !userTeamName) {
    return (
      <div className="@container/main flex flex-1 flex-col items-center justify-center gap-4 min-h-[400px]">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Users className="size-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Not Assigned to a Team</h2>
          <p className="text-muted-foreground mt-1 max-w-md">
            You haven't been assigned to a team yet. Please wait for the host
            or governor to assign you to a team.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-lg">
            <Crown className="size-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{userTeamName}</h1>
            <p className="text-muted-foreground">
              Manage your team as captain
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="w-fit bg-amber-500/10 text-amber-600 border-amber-200"
        >
          <Crown className="size-3 mr-1" />
          Team Captain
        </Badge>
      </div>

      {/* Error State */}
      {error && (
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {leaderboardError && (
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertTitle>Leaderboard Error</AlertTitle>
            <AlertDescription>{leaderboardError}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {stats.map((stat, index) => {
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
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                  {stat.description}
                </div>
                <div className="text-muted-foreground">{stat.detail}</div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Team Members Table */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} member{members.length !== 1 ? 's' : ''} in your team
            </p>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Members Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMembers.length > 0 ? (
                paginatedMembers.map((member, index) => (
                  <TableRow key={member.league_member_id}>
                    <TableCell className="text-muted-foreground">
                      {pagination.pageIndex * pagination.pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="size-10">
                            <AvatarFallback>
                              {member.username
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          {member.is_captain && (
                            <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                              <Crown className="size-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-medium">{member.username}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.is_captain ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
                          <Shield className="size-3 mr-1" />
                          Captain
                        </Badge>
                      ) : (
                        <Badge variant="outline">Player</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm">
                      {(member as any).points ?? 0}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    {searchQuery
                      ? 'No members found matching your search.'
                      : 'No members in this team yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredMembers.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              {filteredMembers.length} member(s) total
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="members-rows" className="text-sm">
                  Rows per page
                </Label>
                <Select
                  value={pagination.pageSize.toString()}
                  onValueChange={(v) =>
                    setPagination({
                      ...pagination,
                      pageSize: Number(v),
                      pageIndex: 0,
                    })
                  }
                >
                  <SelectTrigger className="w-16" id="members-rows">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm">
                Page {pagination.pageIndex + 1} of {pageCount || 1}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPagination({ ...pagination, pageIndex: 0 })}
                  disabled={pagination.pageIndex === 0}
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      pageIndex: pagination.pageIndex - 1,
                    })
                  }
                  disabled={pagination.pageIndex === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      pageIndex: pagination.pageIndex + 1,
                    })
                  }
                  disabled={pagination.pageIndex >= pageCount - 1}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() =>
                    setPagination({ ...pagination, pageIndex: pageCount - 1 })
                  }
                  disabled={pagination.pageIndex >= pageCount - 1}
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
