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
  Target,
  Users,
  Calendar,
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
import { ChallengeFormDialog, type Challenge } from "./challenge-form-dialog";

// ============================================================================
// Badge Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "bg-green-500/10 text-green-600",
    upcoming: "bg-blue-500/10 text-blue-600",
    completed: "bg-gray-500/10 text-gray-600",
    draft: "bg-yellow-500/10 text-yellow-600",
  };

  return (
    <Badge variant="outline" className={variants[status] || variants.draft}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const variants: Record<string, string> = {
    easy: "bg-green-500/10 text-green-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    hard: "bg-red-500/10 text-red-600",
  };

  return (
    <Badge variant="outline" className={variants[difficulty] || variants.medium}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="bg-primary/10 text-primary">
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  );
}

// ============================================================================
// ChallengesTable Component
// ============================================================================

interface ChallengesTableProps {
  data: Challenge[];
}

export function ChallengesTable({ data: initialData }: ChallengesTableProps) {
  const [data, setData] = React.useState<Challenge[]>(initialData);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editingChallenge, setEditingChallenge] = React.useState<Challenge | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [challengeToDelete, setChallengeToDelete] = React.useState<Challenge | null>(null);

  const handleAddChallenge = () => {
    setEditingChallenge(null);
    setFormDialogOpen(true);
  };

  const handleEditChallenge = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (challenge: Challenge) => {
    setChallengeToDelete(challenge);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (challengeToDelete) {
      setData(data.filter((c) => c.id !== challengeToDelete.id));
      toast.success(`Challenge "${challengeToDelete.name}" deleted successfully`);
      setDeleteDialogOpen(false);
      setChallengeToDelete(null);
    }
  };

  const handleFormSubmit = (challengeData: Partial<Challenge>) => {
    if (challengeData.id) {
      setData(data.map((c) => (c.id === challengeData.id ? { ...c, ...challengeData } : c)));
    } else {
      const newChallenge: Challenge = {
        id: Math.max(...data.map((c) => c.id)) + 1,
        name: challengeData.name || "",
        description: challengeData.description || "",
        type: challengeData.type || "streak",
        challengeType: challengeData.challengeType || "individual",
        category: challengeData.category || "cardio",
        difficulty: challengeData.difficulty || "medium",
        status: challengeData.status || "draft",
        points: challengeData.points || 100,
        duration: challengeData.duration || 7,
        startDate: challengeData.startDate || "",
        endDate: challengeData.endDate || "",
        participants: 0,
        completions: 0,
      };
      setData([newChallenge, ...data]);
    }
  };

  const columns: ColumnDef<Challenge>[] = [
    {
      accessorKey: "name",
      header: "Challenge",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Target className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground line-clamp-1 max-w-[200px]">
              {row.original.description}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <TypeBadge type={row.original.type} />,
    },
    {
      accessorKey: "challengeType",
      header: "Challenge Type",
      cell: ({ row }) => {
        const type = row.original.challengeType || "individual";
        const colorMap = {
          individual: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
          team: "bg-green-100 text-green-700 dark:bg-green-900/30",
          sub_team: "bg-purple-100 text-purple-700 dark:bg-purple-900/30",
        };
        return (
          <Badge variant="secondary" className={colorMap[type as keyof typeof colorMap]}>
            {type === "sub_team" ? "Sub-Team" : type.charAt(0).toUpperCase() + type.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "difficulty",
      header: "Difficulty",
      cell: ({ row }) => <DifficultyBadge difficulty={row.original.difficulty} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "points",
      header: "Points",
      cell: ({ row }) => (
        <span className="font-medium text-green-600">+{row.original.points}</span>
      ),
    },
    {
      accessorKey: "participants",
      header: "Participants",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="size-4" />
          <span>{row.original.participants}</span>
        </div>
      ),
    },
    {
      accessorKey: "startDate",
      header: "Duration",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Calendar className="size-4" />
          <span>{row.original.duration} days</span>
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
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => handleEditChallenge(row.original)}>
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

  const table = useReactTable({
    data,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Challenge Management</h1>
          <p className="text-muted-foreground">Create and manage fitness challenges</p>
        </div>
        <Button onClick={handleAddChallenge}>
          <Plus className="mr-2 size-4" />
          Create Challenge
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search challenges..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={(table.getColumn("difficulty")?.getFilterValue() as string) || "all"}
          onValueChange={(value) =>
            table.getColumn("difficulty")?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Difficulties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={(table.getColumn("status")?.getFilterValue() as string) || "all"}
          onValueChange={(value) =>
            table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
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
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No challenges found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} challenge(s) total
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
            Page {pagination.pageIndex + 1} of {table.getPageCount()}
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

      <ChallengeFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        challenge={editingChallenge}
        onSubmit={handleFormSubmit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{challengeToDelete?.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ChallengesTable;
