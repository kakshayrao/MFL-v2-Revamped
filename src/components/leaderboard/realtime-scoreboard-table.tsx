/**
 * Real-time Scoreboard Table
 * Shows the last 1-2 days that are still within the 2-day leaderboard delay window.
 */
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Medal, Star, Trophy, Users } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { cn } from '@/lib/utils';

import type { PendingTeamWindowRanking } from '@/hooks/use-league-leaderboard';

interface RealTimeScoreboardTableProps {
  dates: string[];
  teams: PendingTeamWindowRanking[];
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
        <Trophy className="size-4 text-yellow-600" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-800">
        <Medal className="size-4 text-gray-500" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
        <Medal className="size-4 text-orange-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center size-8 rounded-full bg-muted">
      <span className="text-sm font-medium text-muted-foreground">{rank}</span>
    </div>
  );
}

function formatHeaderDate(dateYYYYMMDD: string): string {
  // Date strings are in YYYY-MM-DD; use local date for display.
  const [y, m, d] = dateYYYYMMDD.split('-').map((p) => Number(p));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return format(dt, 'MMM d');
}

export function RealTimeScoreboardTable({ dates, teams }: RealTimeScoreboardTableProps) {
  if (!dates.length) return null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Rank</TableHead>
            <TableHead>Team</TableHead>
            {dates.map((d) => (
              <TableHead key={d} className="text-right tabular-nums">
                {formatHeaderDate(d)}
              </TableHead>
            ))}
            <TableHead className="text-right">Avg RR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.length ? (
            teams.map((t) => (
              <TableRow
                key={t.team_id}
                className={cn(t.rank <= 3 && 'bg-muted/30')}
              >
                <TableCell>
                  <RankBadge rank={t.rank} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{t.team_name}</p>
                      <p className="text-xs text-muted-foreground">2-day delay window</p>
                    </div>
                  </div>
                </TableCell>
                {dates.map((d) => {
                  const points = t.pointsByDate?.[d] ?? 0;
                  return (
                    <TableCell key={d} className="text-right tabular-nums">
                      <span className={cn('text-lg font-bold', points > 0 ? 'text-primary' : 'text-muted-foreground')}>
                        {points}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Star className="size-4 text-yellow-500" />
                    <span className="font-medium tabular-nums">{t.avg_rr.toFixed(2)}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3 + dates.length} className="h-24 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Users className="size-8 text-muted-foreground" />
                  <p className="text-muted-foreground">No teams found</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default RealTimeScoreboardTable;
