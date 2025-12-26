/**
 * My Submissions Table
 * DataTable component for displaying player's submissions with filtering and pagination.
 */
'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Eye,
  Dumbbell,
  Moon,
  CheckCircle2,
  XCircle,
  Clock3,
  Calendar,
  RefreshCw,
  ShieldAlert,
  Upload,
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
import { cn } from '@/lib/utils';

import { SubmissionDetailDialog } from './submission-detail-dialog';
import type { MySubmission, SubmissionStats } from '@/hooks/use-my-submissions';
import { isExemptionRequest } from '@/hooks/use-my-submissions';
import { useRouter } from 'next/navigation';

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Stats Cards Component
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
      label: 'Approved',
      value: stats.approved,
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Pending',
      value: stats.pending,
      icon: Clock3,
      color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
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
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: MySubmission['status'] }) {
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
// MySubmissionsTable Component
// ============================================================================

interface MySubmissionsTableProps {
  submissions: MySubmission[];
  stats: SubmissionStats;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function MySubmissionsTable({
  submissions,
  stats,
  isLoading,
  error,
  onRefresh,
}: MySubmissionsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'date', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  // Dialog state
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [selectedSubmission, setSelectedSubmission] = React.useState<MySubmission | null>(null);

  // Get league ID from URL
  const leagueId = typeof window !== 'undefined' ? window.location.pathname.split('/')[2] : '';

  // Handle resubmit - redirect to submit page with query params
  const handleResubmit = (submission: MySubmission) => {
    const params = new URLSearchParams({
      resubmit: submission.id,
      date: submission.date,
      type: submission.type,
    });

    if (submission.workout_type) params.set('workout_type', submission.workout_type);
    if (submission.duration) params.set('duration', submission.duration.toString());
    if (submission.distance) params.set('distance', submission.distance.toString());
    if (submission.steps) params.set('steps', submission.steps.toString());
    if (submission.holes) params.set('holes', submission.holes.toString());
    if (submission.notes) params.set('notes', submission.notes);
    if (submission.proof_url) params.set('proof_url', submission.proof_url);

    router.push(`/leagues/${leagueId}/submit?${params.toString()}`);
  };

  // Filter submissions by status
  const filteredSubmissions = React.useMemo(() => {
    if (statusFilter === 'all') return submissions;
    return submissions.filter((s) => s.status === statusFilter);
  }, [submissions, statusFilter]);

  // Determine which submissions can be resubmitted
  // Core Rule: Re-submit button appears ONLY on original submissions (reupload_of = null) when rejected
  const resubmittableIds = React.useMemo(() => {
    const canResubmit = new Set<string>();

    submissions.forEach((sub) => {
      // Only original submissions can have re-submit button
      if (sub.reupload_of === null && sub.status === 'rejected') {
        canResubmit.add(sub.id);
      }
    });

    return canResubmit;
  }, [submissions]);

  // Note: Only reupload entries (reupload_of != null) should display the
  // "Re-submitted" indicator. Originals should remain unmarked.

  // Format workout type for display
  const formatWorkoutType = (type: string | null) => {
    if (!type) return 'General';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnDef<MySubmission>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="font-medium">
            {format(parseISO(row.original.date), 'MMM d, yyyy')}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => {
        const isWorkout = row.original.type === 'workout';
        const isExemption = isExemptionRequest(row.original);
        return (
          <div className="flex items-center gap-2">
            {isWorkout ? (
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Dumbbell className="size-4 text-primary" />
              </div>
            ) : isExemption ? (
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <ShieldAlert className="size-4 text-amber-600" />
              </div>
            ) : (
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Moon className="size-4 text-blue-600" />
              </div>
            )}
            <div>
              <p className="font-medium">
                {isWorkout ? 'Workout' : isExemption ? 'Exemption' : 'Rest'}
              </p>
              {isWorkout && row.original.workout_type && (
                <p className="text-xs text-muted-foreground">
                  {formatWorkoutType(row.original.workout_type)}
                </p>
              )}
              {isExemption && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Awaiting approval
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'rr_value',
      header: 'Points',
      cell: ({ row }) => {
        const value = row.original.rr_value;
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <span className="font-semibold text-primary">
            {value.toFixed(1)} RR
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={row.original.status} />
            {/* Show (Re-submitted) label only on reupload entries */}
            {Boolean(row.original.reupload_of) && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                <RefreshCw className="size-2.5 mr-1" />
                Re-submitted
              </Badge>
            )}
            {/* Version badge removed per UX: no vX display */}
          </div>
          {/* Show rejection reason below status */}
          {row.original.status === 'rejected' && row.original.rejection_reason && (
            <p className="text-xs text-red-600 dark:text-red-400 line-clamp-1" title={row.original.rejection_reason}>
              {row.original.rejection_reason}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
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
            <span className="sr-only">View details</span>
          </Button>
          {/* Re-submit button: ONLY on original submissions when rejected */}
          {resubmittableIds.has(row.original.id) && (
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
              onClick={() => handleResubmit(row.original)}
            >
              <Upload className="size-3.5 mr-1" />
              Re-submit
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ============================================================================
  // Table Instance
  // ============================================================================

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

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">My Submissions</h2>
          <p className="text-sm text-muted-foreground">
            Track your workout submissions and their approval status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by date or type..."
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

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
          <p className="text-sm font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={onRefresh}
          >
            Try Again
          </Button>
        </div>
      )}

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
                      <Dumbbell className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No submissions yet</p>
                      <p className="text-sm text-muted-foreground">
                        {statusFilter !== 'all'
                          ? `No ${statusFilter} submissions found`
                          : 'Submit your first workout to get started!'}
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

      {/* Detail Dialog */}
      <SubmissionDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        submission={selectedSubmission}
        isOwner={true}
        onReupload={() => {
          if (selectedSubmission) {
            handleResubmit(selectedSubmission);
          }
        }}
      />
    </div>
  );
}

export default MySubmissionsTable;
