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
  Zap,
  Loader2,
  Filter,
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

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ActivityFormDialog } from "./activity-form-dialog";
import { useAdminActivities } from "@/hooks/admin";
import type { AdminActivity } from "@/types/admin";

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
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ActivitiesTable Component
// ============================================================================

export function ActivitiesTable() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editingActivity, setEditingActivity] = React.useState<AdminActivity | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [activityToDelete, setActivityToDelete] = React.useState<AdminActivity | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Create Category dialog state
  const [catDialogOpen, setCatDialogOpen] = React.useState(false);
  const [catName, setCatName] = React.useState("");
  const [catDesc, setCatDesc] = React.useState("");
  const [catSaving, setCatSaving] = React.useState(false);
  const [catListOpen, setCatListOpen] = React.useState(false);
  const [catList, setCatList] = React.useState<{ category_id: string; display_name: string; category_name: string; description?: string | null; usage_count?: number }[]>([]);
  const [catListLoading, setCatListLoading] = React.useState(false);

  // Fetch activities with hook
  const { activities, isLoading, error, createActivity, updateActivity, deleteActivity, refetch } =
    useAdminActivities({ category_id: categoryFilter === "all" ? undefined : categoryFilter });

  const categoryOptions = React.useMemo(() => {
    const unique = new Map<string, { id: string; name: string }>();
    activities.forEach((a) => {
      if (a.category && a.category.category_id) {
        unique.set(a.category.category_id, {
          id: a.category.category_id,
          name: a.category.display_name || a.category.category_name,
        });
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [activities]);

  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value);
    setColumnFilters((prev) => {
      const withoutCategory = prev.filter((f) => f.id !== "category_id");
      if (value === "all") return withoutCategory;
      return [...withoutCategory, { id: "category_id", value }];
    });
  };

  const handleAddActivity = () => {
    setEditingActivity(null);
    setFormDialogOpen(true);
  };

  const handleAddCategory = () => {
    setCatDialogOpen(true);
  };

  const handleViewCategories = async () => {
    setCatListOpen(true);
    setCatListLoading(true);
    try {
      const res = await fetch('/api/admin/activity-categories');
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) setCatList(json.data);
      else setCatList([]);
    } catch {
      setCatList([]);
    } finally {
      setCatListLoading(false);
    }
  };

  const handleEditActivity = (activity: AdminActivity) => {
    setEditingActivity(activity);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (activity: AdminActivity) => {
    setActivityToDelete(activity);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (activityToDelete) {
      setIsDeleting(true);
      const success = await deleteActivity(activityToDelete.activity_id);
      setIsDeleting(false);

      if (success) {
        toast.success(`Activity "${activityToDelete.activity_name}" deleted successfully`);
        setDeleteDialogOpen(false);
        setActivityToDelete(null);
      } else {
        toast.error("Failed to delete activity. It may be in use by leagues.");
      }
    }
  };

  const handleFormSubmit = async (activityData: {
    activity_name: string;
    description?: string;
    category_id?: string | "";
  }) => {
    if (editingActivity) {
      // Edit existing activity
      const result = await updateActivity(editingActivity.activity_id, {
        activity_name: activityData.activity_name,
        description: activityData.description || null,
        category_id: activityData.category_id ? activityData.category_id : null,
      });

      if (result) {
        toast.success("Activity updated successfully");
        setFormDialogOpen(false);
      } else {
        toast.error("Failed to update activity");
      }
    } else {
      // Add new activity
      const result = await createActivity({
        activity_name: activityData.activity_name,
        description: activityData.description,
        category_id: activityData.category_id ? activityData.category_id : null,
      });

      if (result) {
        toast.success("Activity created successfully");
        setFormDialogOpen(false);
      } else {
        toast.error("Failed to create activity");
      }
    }
  };

  const columns: ColumnDef<AdminActivity>[] = [
    {
      accessorKey: "activity_name",
      header: "Activity",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.original.activity_name}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground line-clamp-2 max-w-[300px]">
          {row.original.description || "No description"}
        </span>
      ),
    },
    {
      accessorKey: "category_id",
      header: "Category",
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        return row.getValue<string | null>(columnId) === filterValue;
      },
      cell: ({ row }) => {
        const category = row.original.category;
        if (!category) {
          return <span className="text-muted-foreground">Uncategorized</span>;
        }
        return <Badge variant="outline">{category.display_name || category.category_name}</Badge>;
      },
    },
    {
      accessorKey: "created_date",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.created_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleEditActivity(row.original)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDeleteClick(row.original)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Use empty array if there's an error
  const displayData = error ? [] : activities;

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

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Management</h1>
          <p className="text-muted-foreground">Create and manage trackable activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleViewCategories}>
            View Categories
          </Button>
          <Button variant="outline" onClick={handleAddCategory}>
            <Plus className="mr-2 size-4" />
            Add Category
          </Button>
          <Button onClick={handleAddActivity}>
            <Plus className="mr-2 size-4" />
            Add Activity
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Category</Label>
          <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Filter className="size-4" />
                  <span>All categories</span>
                </div>
              </SelectItem>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
                      <Zap className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No activities found</p>
                      <p className="text-sm text-muted-foreground">
                        {error
                          ? "Unable to load activities. Please try again."
                          : "Get started by creating a new activity."}
                      </p>
                    </div>
                    {!error && (
                      <Button size="sm" onClick={handleAddActivity}>
                        <Plus className="mr-2 size-4" />
                        Add Activity
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} activity(ies) total
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

      <ActivityFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        activity={editingActivity}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{activityToDelete?.activity_name}"? This action cannot be
              undone. Note: Activities that are in use by leagues cannot be deleted.
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
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>Define a new activity category.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="catName">Display Name *</Label>
              <Input
                id="catName"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Cardio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catDesc">Description</Label>
              <Textarea
                id="catDesc"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                rows={3}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatDialogOpen(false)} disabled={catSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={catSaving || !catName.trim()}
              onClick={async () => {
                if (!catName.trim()) return;
                setCatSaving(true);
                try {
                  const res = await fetch('/api/admin/activity-categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ display_name: catName.trim(), description: catDesc || null }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.error || 'Failed to create category');
                  toast.success('Category created');
                  setCatDialogOpen(false);
                  setCatName('');
                  setCatDesc('');
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to create category');
                } finally {
                  setCatSaving(false);
                }
              }}
            >
              {catSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Categories Dialog */}
      <Dialog open={catListOpen} onOpenChange={setCatListOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Categories</DialogTitle>
            <DialogDescription>Manage existing activity categories.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {catListLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading...
              </div>
            ) : catList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories found.</p>
            ) : (
              catList.map((c) => {
                const inUse = (c.usage_count || 0) > 0;
                return (
                <div key={c.category_id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{c.display_name || c.category_name}</div>
                    {c.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{c.description}</div>
                    )}
                    {inUse && (
                      <div className="text-xs text-amber-600 mt-1">In use by {c.usage_count} activity(ies)</div>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={inUse}
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete category "${c.display_name || c.category_name}"?`);
                      if (!confirmed) return;
                      try {
                        const res = await fetch(`/api/admin/activity-categories/${c.category_id}`, { method: 'DELETE' });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json?.error || 'Failed to delete');
                        toast.success('Category deleted');
                        // Refresh list
                        const r = await fetch('/api/admin/activity-categories');
                        const j = await r.json();
                        if (r.ok && Array.isArray(j.data)) setCatList(j.data);
                      } catch (e: any) {
                        toast.error(e?.message || 'Unable to delete category');
                      }
                    }}
                  >
                    <Trash2 className="mr-2 size-4" /> Delete
                  </Button>
                </div>
              );
              })
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatListOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ActivitiesTable;
