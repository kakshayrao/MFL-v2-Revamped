/**
 * All Submissions Page (Host/Governor)
 * Validation queue for all league submissions with team filtering.
 */
'use client';

import * as React from 'react';
import { use, useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock3,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Eye,
  Shield,
  Crown,
  Dumbbell,
  Moon,
  Calendar,
  RefreshCw,
  Check,
  X,
  Loader2,
  Users,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import { useLeague } from '@/contexts/league-context';
import { useRole } from '@/contexts/role-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import { SubmissionDetailDialog } from '@/components/submissions';

// ============================================================================
// Types
// ============================================================================

interface LeagueSubmission {
  id: string;
  league_member_id: string;
  date: string;
  type: 'workout' | 'rest';
  workout_type: string | null;
  duration: number | null;
  distance: number | null;
  steps: number | null;
  holes: number | null;
  rr_value: number | null;
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string | null;
  notes: string | null;
  created_date: string;
  modified_date: string;
  member: {
    user_id: string;
    username: string;
    email: string;
    team_id: string | null;
    team_name: string | null;
  };
}

interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface TeamOption {
  team_id: string;
  team_name: string;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function PageSkeleton() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex items-start gap-4">
          <Skeleton className="size-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4 px-4 lg:px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="px-4 lg:px-6 space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Stats Cards
// ============================================================================

function StatsCards({ stats }: { stats: SubmissionStats }) {
  const cards = [
    {
      label: 'Total',
      value: stats.total,
      icon: Calendar,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Pending',
      value: stats.pending,
      icon: Clock3,
      color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      label: 'Approved',
      value: stats.approved,
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Rejected',
      value: stats.rejected,
      icon: XCircle,
      color: 'text-red-600 bg-red-100 dark:bg-red-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 p-4 rounded-lg border bg-card"
        >
          <div className={cn('flex size-10 items-center justify-center rounded-lg', card.color)}>
            <card.icon className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: LeagueSubmission['status'] }) {
  const config = {
    pending: {
      label: 'Pending',
      icon: Clock3,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    approved: {
      label: 'Approved',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    rejected: {
      label: 'Rejected',
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn('gap-1', className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

// ============================================================================
// All Submissions Page
// ============================================================================

export default function AllSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = use(params);
  const { activeLeague } = useLeague();
  const { isHost, isGovernor } = useRole();

  const [submissions, setSubmissions] = useState<LeagueSubmission[]>([]);
  const [stats, setStats] = useState<SubmissionStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [tableAwardedPoints, setTableAwardedPoints] = useState<Record<string, number | ''>>({});

  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<LeagueSubmission | null>(null);

  // Fetch submissions
  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/leagues/${leagueId}/submissions`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch submissions');
      }

      if (result.success) {
        setSubmissions(result.data.submissions);
        setStats(result.data.stats);
        setTeams(result.data.teams || []);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [leagueId]);

  // Handle validation (approve/reject)
  const handleValidate = async (submissionId: string, newStatus: 'approved' | 'rejected', awardedPoints?: number | null) => {
    // Find the submission to get its current status
    const submission = submissions.find((s) => s.id === submissionId);
    if (!submission) return;

    const oldStatus = submission.status;

    // Don't do anything if status is the same
    if (oldStatus === newStatus) return;

    try {
      setValidatingId(submissionId);

      const body: any = { status: newStatus };
      if (awardedPoints !== undefined) body.awardedPoints = awardedPoints;
      const response = await fetch(`/api/submissions/${submissionId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to validate submission');
      }

      toast.success(
        oldStatus === 'pending'
          ? `Submission ${newStatus}`
          : `Submission overridden to ${newStatus}`
      );

      // Update local state
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: newStatus } : s))
      );

      // Update stats: decrement OLD status, increment NEW status
      setStats((prev) => ({
        ...prev,
        [oldStatus]: prev[oldStatus] - 1,
        [newStatus]: prev[newStatus] + 1,
      }));
    } catch (err) {
      console.error('Error validating submission:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to validate');
    } finally {
      setValidatingId(null);
    }
  };

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    let filtered = submissions;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => s.status === statusFilter);
    }

    if (teamFilter !== 'all') {
      filtered = filtered.filter((s) => s.member.team_id === teamFilter);
    }

    return filtered;
  }, [submissions, statusFilter, teamFilter]);

  // Format workout type for display
  const formatWorkoutType = (type: string | null) => {
    if (!type) return 'General';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Table columns
  const columns: ColumnDef<LeagueSubmission>[] = [
    {
      accessorKey: 'member',
      header: 'Member',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {row.original.member.username
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{row.original.member.username}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.member.team_name || 'Unassigned'}
            </p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">
          {format(parseISO(row.original.date), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const isWorkout = row.original.type === 'workout';
        const isExemption = row.original.type === 'rest' &&
          row.original.notes?.includes('[EXEMPTION_REQUEST]');
        return (
          <div className="flex items-center gap-2">
            {isWorkout ? (
              <Dumbbell className="size-4 text-primary" />
            ) : isExemption ? (
              <ShieldAlert className="size-4 text-amber-500" />
            ) : (
              <Moon className="size-4 text-blue-500" />
            )}
            <span className="text-sm">
              {isWorkout
                ? formatWorkoutType(row.original.workout_type)
                : isExemption
                  ? 'Exemption Request'
                  : 'Rest Day'}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'rr_value',
      header: 'Points',
      cell: ({ row }) => {
        const value = row.original.rr_value;
        if (value === null) return <span className="text-muted-foreground">-</span>;
        return <span className="font-semibold text-primary">{value.toFixed(1)} RR</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isPending = row.original.status === 'pending';
        const isValidating = validatingId === row.original.id;
        const currentStatus = row.original.status;
        // Host and Governor can override any status (approve/reject even non-pending)
        const canOverride = isHost || isGovernor;

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                setSelectedSubmission(row.original);
                setDetailDialogOpen(true);
              }}
              title="View details"
            >
              <Eye className="size-4" />
            </Button>
            {/* Show approve button if pending OR if Host/Governor wants to override to approved */}
            {(isPending || (canOverride && currentStatus !== 'approved')) && (
              <>
                <Input
                  type="number"
                  min={0}
                  placeholder="Pts"
                  value={tableAwardedPoints[row.original.id] ?? ''}
                  onChange={(e) => setTableAwardedPoints((p) => ({ ...p, [row.original.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="w-20"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleValidate(row.original.id, 'approved', tableAwardedPoints[row.original.id] === '' ? undefined : (tableAwardedPoints[row.original.id] as number))}
                  disabled={isValidating}
                  title={isPending ? 'Approve' : 'Override to Approved'}
                >
                  {isValidating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </Button>
              </>
            )}
            {/* Show reject button if pending OR if Host/Governor wants to override to rejected */}
            {(isPending || (canOverride && currentStatus !== 'rejected')) && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleValidate(row.original.id, 'rejected', null)}
                disabled={isValidating}
                title={isPending ? 'Reject' : 'Override to Rejected'}
              >
                {isValidating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Table instance
  const table = useReactTable({
    data: filteredSubmissions,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Access check
  if (!isHost && !isGovernor) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              Only host or governor can view all league submissions.
            </AlertDescription>
          </Alert>
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
          <div className="size-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg">
            <ClipboardCheck className="size-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Submissions</h1>
            <p className="text-muted-foreground">
              Review and validate submissions from all teams
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              isHost
                ? 'bg-purple-500/10 text-purple-600 border-purple-200'
                : 'bg-blue-500/10 text-blue-600 border-blue-200'
            )}
          >
            {isHost ? (
              <>
                <Crown className="size-3 mr-1" />
                Host
              </>
            ) : (
              <>
                <Shield className="size-3 mr-1" />
                Governor
              </>
            )}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchSubmissions}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 space-y-6">
        {/* Stats */}
        <StatsCards stats={stats} />

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by member..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[180px]">
              <Users className="mr-2 size-4" />
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.team_id} value={team.team_id}>
                  {team.team_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-48">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <ClipboardCheck className="size-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">No submissions</p>
                        <p className="text-sm text-muted-foreground">
                          {statusFilter !== 'all' || teamFilter !== 'all'
                            ? 'No submissions match your filters'
                            : 'No submissions in this league yet'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filteredSubmissions.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left info */}
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              {table.getFilteredRowModel().rows.length} submission(s)
            </div>

            {/* Right controls */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Rows per page */}
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Rows</Label>
                <Select
                  value={`${pagination.pageSize}`}
                  onValueChange={(value) =>
                    setPagination({ ...pagination, pageSize: Number(value) })
                  }
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page info */}
              <div className="text-xs whitespace-nowrap">
                Page {pagination.pageIndex + 1} / {table.getPageCount() || 1}
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="size-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="size-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="size-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      {selectedSubmission && (
        <SubmissionDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          submission={{
            id: selectedSubmission.id,
            date: selectedSubmission.date,
            type: selectedSubmission.type,
            workout_type: selectedSubmission.workout_type,
            duration: selectedSubmission.duration,
            distance: selectedSubmission.distance,
            steps: selectedSubmission.steps,
            holes: selectedSubmission.holes,
            rr_value: selectedSubmission.rr_value,
            status: selectedSubmission.status,
            proof_url: selectedSubmission.proof_url,
            notes: selectedSubmission.notes,
            created_date: selectedSubmission.created_date,
            modified_date: selectedSubmission.modified_date,
          }}
          canOverride={isHost || isGovernor}
          onApprove={(id) => {
            handleValidate(id, 'approved');
            setDetailDialogOpen(false);
          }}
          onReject={(id) => {
            handleValidate(id, 'rejected');
            setDetailDialogOpen(false);
          }}
          isValidating={validatingId === selectedSubmission.id}
        />
      )}
    </div>
  );
}
