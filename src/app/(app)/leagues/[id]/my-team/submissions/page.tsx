/**
 * Team Submissions Page (Captain)
 * Captain's validation queue for their team's submissions.
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
  Crown,
  Dumbbell,
  Moon,
  Calendar,
  RefreshCw,
  Check,
  X,
  Loader2,
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

interface TeamSubmission {
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
  };
}

interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
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
        <Skeleton className="h-10 w-64" />
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

function StatusBadge({ status }: { status: TeamSubmission['status'] }) {
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
// Team Submissions Page
// ============================================================================

export default function TeamSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = use(params);
  const { activeLeague } = useLeague();
  const { isCaptain } = useRole();

  const [submissions, setSubmissions] = useState<TeamSubmission[]>([]);
  const [stats, setStats] = useState<SubmissionStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [tableAwardedPoints, setTableAwardedPoints] = useState<Record<string, number | ''>>({});

  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<TeamSubmission | null>(null);

  // Fetch submissions
  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/leagues/${leagueId}/my-team/submissions`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch submissions');
      }

      if (result.success) {
        setSubmissions(result.data.submissions);
        setStats(result.data.stats);
      }
    } catch (err) {
      console.error('Error fetching team submissions:', err);
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

      toast.success(`Submission ${newStatus}`);

      // Update local state
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status: newStatus } : s))
      );
      setStats((prev) => ({
        ...prev,
        pending: prev.pending - 1,
        [newStatus]: prev[newStatus] + 1,
      }));
    } catch (err) {
      console.error('Error validating submission:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to validate');
    } finally {
      setValidatingId(null);
    }
  };

  // Filter submissions by status
  const filteredSubmissions = useMemo(() => {
    if (statusFilter === 'all') return submissions;
    return submissions.filter((s) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  // Format workout type for display
  const formatWorkoutType = (type: string | null) => {
    if (!type) return 'General';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Table columns
  const columns: ColumnDef<TeamSubmission>[] = [
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
          <span className="font-medium">{row.original.member.username}</span>
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
      cell: ({ row }) => {
        const isPending = row.original.status === 'pending';
        const isValidating = validatingId === row.original.id;

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
            >
              <Eye className="size-4" />
            </Button>
            {isPending && (
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
                >
                  {isValidating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleValidate(row.original.id, 'rejected', null)}
                  disabled={isValidating}
                >
                  <X className="size-4" />
                </Button>
              </>
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
  if (!isCaptain) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
        <div className="px-4 lg:px-6">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              Only team captains can validate team submissions.
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
          <div className="size-14 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-lg">
            <ClipboardCheck className="size-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Team Submissions</h1>
            <p className="text-muted-foreground">
              Validate submissions from your team members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-600 border-amber-200"
          >
            <Crown className="size-3 mr-1" />
            Team Captain
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
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
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
                          {statusFilter !== 'all'
                            ? `No ${statusFilter} submissions from your team`
                            : 'No submissions from your team yet'}
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} submission(s)
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Label htmlFor="rows-per-page" className="text-sm">
                  Rows per page
                </Label>
                <Select
                  value={`${pagination.pageSize}`}
                  onValueChange={(value) =>
                    setPagination({ ...pagination, pageSize: Number(value) })
                  }
                >
                  <SelectTrigger className="w-16" id="rows-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm">
                Page {pagination.pageIndex + 1} of {table.getPageCount() || 1}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Dialog - reuse the same component, adapted for TeamSubmission */}
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
          canOverride={false}
          onApprove={selectedSubmission.status === 'pending' ? (id) => {
            handleValidate(id, 'approved');
            setDetailDialogOpen(false);
          } : undefined}
          onReject={selectedSubmission.status === 'pending' ? (id) => {
            handleValidate(id, 'rejected');
            setDetailDialogOpen(false);
          } : undefined}
          isValidating={validatingId === selectedSubmission.id}
        />
      )}
    </div>
  );
}
