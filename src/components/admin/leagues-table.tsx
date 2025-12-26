"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  Plus,
  Search,
  Pencil,
  Trash2,
  Trophy,
  Users,
  Calendar,
  Loader2,
  Globe,
  Lock,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueFormDialog } from "./league-form-dialog";
import { useAdminLeagues } from "@/hooks/admin";
import type { AdminLeague, LeagueStatus } from "@/types/admin";

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: LeagueStatus }) {
  const variants: Record<LeagueStatus, string> = {
    active: "bg-green-500/10 text-green-600",
    launched: "bg-blue-500/10 text-blue-600",
    completed: "bg-gray-500/10 text-gray-600",
    draft: "bg-yellow-500/10 text-yellow-600",
  };

  return (
    <Badge variant="outline" className={variants[status] || variants.draft}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

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
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LeaguesTable Component
// ============================================================================

export function LeaguesTable() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editingLeague, setEditingLeague] = React.useState<AdminLeague | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [leagueToDelete, setLeagueToDelete] = React.useState<AdminLeague | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Fetch leagues with hook
  const { leagues, isLoading, error, createLeague, updateLeague, deleteLeague, refetch } =
    useAdminLeagues();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAddLeague = () => {
    setEditingLeague(null);
    setFormDialogOpen(true);
  };

  const handleEditLeague = (league: AdminLeague) => {
    setEditingLeague(league);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (league: AdminLeague) => {
    setLeagueToDelete(league);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (leagueToDelete) {
      setIsDeleting(true);
      const success = await deleteLeague(leagueToDelete.league_id);
      setIsDeleting(false);

      if (success) {
        toast.success(`League "${leagueToDelete.league_name}" deactivated successfully`);
        setDeleteDialogOpen(false);
        setLeagueToDelete(null);
      } else {
        toast.error("Failed to deactivate league");
      }
    }
  };

  const handleFormSubmit = async (leagueData: {
    league_name: string;
    description?: string;
    start_date: string;
    end_date: string;
    num_teams?: number;
    rest_days?: number;
    is_public?: boolean;
    is_exclusive?: boolean;
    status?: LeagueStatus;
    is_active?: boolean;
  }) => {
    if (editingLeague) {
      // Edit existing league
      const result = await updateLeague(editingLeague.league_id, {
        league_name: leagueData.league_name,
        description: leagueData.description || null,
        start_date: leagueData.start_date,
        end_date: leagueData.end_date,
        num_teams: leagueData.num_teams,
        rest_days: leagueData.rest_days,
        is_public: leagueData.is_public,
        is_exclusive: leagueData.is_exclusive,
        status: leagueData.status,
        is_active: leagueData.is_active,
      });

      if (result) {
        toast.success("League updated successfully");
        setFormDialogOpen(false);
      } else {
        toast.error("Failed to update league");
      }
    } else {
      // Add new league
      const result = await createLeague({
        league_name: leagueData.league_name,
        description: leagueData.description,
        start_date: leagueData.start_date,
        end_date: leagueData.end_date,
        num_teams: leagueData.num_teams,
        rest_days: leagueData.rest_days,
        is_public: leagueData.is_public,
        is_exclusive: leagueData.is_exclusive,
      });

      if (result) {
        toast.success("League created successfully");
        setFormDialogOpen(false);
      } else {
        toast.error("Failed to create league");
      }
    }
  };

  // ============================================================================
  // Filtered Data
  // ============================================================================

  const filteredData = React.useMemo(() => {
    let result = leagues;

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }

    return result;
  }, [leagues, statusFilter]);

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnDef<AdminLeague>[] = [
    {
      accessorKey: "league_name",
      header: "League",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.original.league_name}</div>
            <div className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
              {row.original.description || "No description"}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "is_public",
      header: "Visibility",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          {row.original.is_public ? (
            <>
              <Globe className="size-4" />
              <span className="text-sm">Public</span>
            </>
          ) : (
            <>
              <Lock className="size-4" />
              <span className="text-sm">Private</span>
            </>
          )}
        </div>
      ),
    },
    {
      accessorKey: "member_count",
      header: "Members",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="size-4" />
          <span>{row.original.member_count || 0}</span>
        </div>
      ),
    },
    {
      accessorKey: "num_teams",
      header: "Teams",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.num_teams} teams
        </span>
      ),
    },
    {
      accessorKey: "start_date",
      header: "Duration",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Calendar className="size-4" />
          <span>
            {new Date(row.original.start_date).toLocaleDateString()} -{" "}
            {new Date(row.original.end_date).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleEditLeague(row.original)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeleteClick(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ============================================================================
  // Table Instance
  // ============================================================================

  // Use empty array if there's an error
  const displayData = error ? [] : filteredData;

  const table = useReactTable({
    data: displayData,
    columns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">League Management</h1>
          <p className="text-muted-foreground">Create and manage fitness leagues</p>
        </div>
        <Button onClick={handleAddLeague}>
          <Plus className="mr-2 size-4" />
          Create League
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leagues..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="launched">Launched</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
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
                      <Trophy className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No leagues found</p>
                      <p className="text-sm text-muted-foreground">
                        {error
                          ? "Unable to load leagues. Please try again."
                          : "Get started by creating a new league."}
                      </p>
                    </div>
                    {!error && (
                      <Button size="sm" onClick={handleAddLeague}>
                        <Plus className="mr-2 size-4" />
                        Create League
                      </Button>
                    )}
                    {error && (
                      <Button size="sm" variant="outline" onClick={refetch}>
                        Try Again
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} league(s) total
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="rows-per-page" className="text-sm">
              Rows per page
            </Label>
            <Select
              value={`${pagination.pageSize}`}
              onValueChange={(value) => setPagination({ ...pagination, pageSize: Number(value) })}
            >
              <SelectTrigger className="w-16" id="rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50].map((size) => (
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

      {/* Form Dialog */}
      <LeagueFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        league={editingLeague}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate League</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{leagueToDelete?.league_name}"? The league will no longer be accessible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default LeaguesTable;
