'use client';

import React, { use, useState, useMemo, useEffect } from 'react';
import {
  Users,
  Trophy,
  Target,
  Crown,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import { useLeague } from '@/contexts/league-context';
import { useRole } from '@/contexts/role-context';

import {
  Card,
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

import { Skeleton } from '@/components/ui/skeleton';
import { TeamsTable } from '@/components/teams';

/* ============================================================================
   Skeleton
============================================================================ */

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

/* ============================================================================
   Team Member View
============================================================================ */

interface TeamMemberViewProps {
  leagueId: string;
  teamId: string;
  teamName: string;
  teamSize: number;
  isCaptain: boolean;
}

function TeamMemberView({
  leagueId,
  teamId,
  teamName,
  teamSize,
  isCaptain,
}: TeamMemberViewProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const [teamRank, setTeamRank] = useState('#--');
  const [teamPoints, setTeamPoints] = useState('--');

  /* ---------------- Fetch Members + Points ---------------- */

  useEffect(() => {
    async function fetchData() {
      try {
        const membersRes = await fetch(
          `/api/leagues/${leagueId}/teams/${teamId}/members`
        );
        const membersJson = await membersRes.json();

        let membersWithPoints = (membersJson.data || []).map((m: any) => ({
          ...m,
          points: 0,
        }));

        const leaderboardRes = await fetch(
          `/api/leagues/${leagueId}/leaderboard?full=true`
        );
        const leaderboardJson = await leaderboardRes.json();

        if (leaderboardJson?.data?.individuals) {
          const pointsMap = new Map(
            leaderboardJson.data.individuals.map((i: any) => [
              String(i.user_id),
              Number(i.points || 0),
            ])
          );

          membersWithPoints = membersWithPoints.map((m: any) => ({
            ...m,
            points: pointsMap.get(String(m.user_id)) ?? 0,
          }));
        }

        if (leaderboardJson?.data?.teams) {
          const team = leaderboardJson.data.teams.find(
            (t: any) => String(t.team_id) === String(teamId)
          );
          if (team) {
            setTeamRank(`#${team.rank ?? '--'}`);
            setTeamPoints(String(team.total_points ?? 0));
          }
        }

        setMembers(membersWithPoints);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [leagueId, teamId]);

  const filteredMembers = useMemo(
    () =>
      members.filter((m) =>
        m.username.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [members, searchQuery]
  );

  const paginatedMembers = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return filteredMembers.slice(start, start + pagination.pageSize);
  }, [filteredMembers, pagination]);

  const pageCount = Math.ceil(filteredMembers.length / pagination.pageSize);

  if (isLoading) return <PageSkeleton />;

  /* ========================================================================= */

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-xl bg-primary flex items-center justify-center">
            <Users className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{teamName}</h1>
            <p className="text-muted-foreground">
              {isCaptain ? 'Team Captain View' : 'Team Members'}
            </p>
          </div>
        </div>
        <Badge variant="outline">
          <Crown className="size-3 mr-1" />
          Captain
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard title="Team Rank" value={teamRank} icon={Trophy} />
        <StatCard
          title="Team Members"
          value={`${members.length}/${teamSize}`}
          icon={Users}
        />
        <StatCard title="Team Points" value={teamPoints} icon={Target} />
      </div>

      {/* Members Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedMembers.map((m, i) => (
              <TableRow key={m.league_member_id}>
                <TableCell>
                  {pagination.pageIndex * pagination.pageSize + i + 1}
                </TableCell>
                <TableCell className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {m.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {m.username}
                </TableCell>
                <TableCell>
                  {m.is_captain ? (
                    <Badge>
                      <Shield className="size-3 mr-1" />
                      Captain
                    </Badge>
                  ) : (
                    <Badge variant="outline">Player</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {m.points}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {pagination.pageIndex + 1} of {pageCount || 1}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setPagination({ ...pagination, pageIndex: 0 })}
            disabled={pagination.pageIndex === 0}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() =>
              setPagination({ ...pagination, pageIndex: pagination.pageIndex - 1 })
            }
            disabled={pagination.pageIndex === 0}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() =>
              setPagination({ ...pagination, pageIndex: pagination.pageIndex + 1 })
            }
            disabled={pagination.pageIndex >= pageCount - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
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
  );
}

/* ============================================================================
   Stat Card
============================================================================ */

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {title}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

/* ============================================================================
   Team Page (Router)
============================================================================ */

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = use(params);
  const { activeLeague } = useLeague();
  const { isHost, isGovernor, isCaptain } = useRole();

  const canManageTeams = isHost || isGovernor;

  if (canManageTeams) {
    return (
      <div className="p-6">
        <TeamsTable
          leagueId={leagueId}
          isHost={isHost}
          isGovernor={isGovernor}
        />
      </div>
    );
  }

  if (activeLeague?.team_id && activeLeague?.team_name) {
    return (
      <TeamMemberView
        leagueId={leagueId}
        teamId={activeLeague.team_id}
        teamName={activeLeague.team_name}
        teamSize={activeLeague.team_size || 5}
        isCaptain={isCaptain}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-96">
      <p className="text-muted-foreground">Not assigned to a team</p>
    </div>
  );
}
