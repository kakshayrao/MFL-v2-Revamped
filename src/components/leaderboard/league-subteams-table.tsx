/**
 * League Sub-Teams Table
 * DataTable component for displaying sub-team rankings in the leaderboard.
 */
'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Medal, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import type { SubTeamRanking } from '@/hooks/use-league-leaderboard';

// ============================================================================
// Types
// ============================================================================

interface LeagueSubTeamsTableProps {
  subTeams: SubTeamRanking[];
}

// ============================================================================
// Rank Badge Component
// ============================================================================

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
        <Medal className="size-4 text-yellow-600" />
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

// ============================================================================
// Main Component
// ============================================================================

export function LeagueSubTeamsTable({ subTeams }: LeagueSubTeamsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const columns: ColumnDef<SubTeamRanking>[] = React.useMemo(
    () => [
      {
        accessorKey: 'rank',
        header: 'Rank',
        cell: ({ row }) => <RankBadge rank={row.original.rank} />,
        size: 60,
      },
      {
        accessorKey: 'subteam_name',
        header: 'Sub-Team',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{row.original.subteam_name}</p>
              <p className="text-xs text-muted-foreground">
                {row.original.team_name || '—'}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'points',
        header: 'Points',
        cell: ({ row }) => (
          <p className="text-lg font-bold text-primary">
            {row.original.points}
          </p>
        ),
      },
      {
        accessorKey: 'submission_count',
        header: 'Submissions',
        cell: ({ row }) => <Badge variant="secondary">{row.original.submission_count}</Badge>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: subTeams,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(row.original.rank <= 3 && 'bg-muted/30')}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Users className="size-8 text-muted-foreground" />
                  <p className="text-muted-foreground">No sub-teams found</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default LeagueSubTeamsTable;
