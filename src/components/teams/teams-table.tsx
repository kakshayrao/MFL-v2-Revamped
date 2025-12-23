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
  Users,
  Crown,
  UserPlus,
  Shield,
  Loader2,
  Share2,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { CreateTeamDialog } from "./create-team-dialog";
import { AddMembersDialog } from "./add-members-dialog";
import { AssignCaptainDialog } from "./assign-captain-dialog";
import { AssignGovernorDialog } from "./assign-governor-dialog";
import { ViewUnallocatedDialog } from "./view-unallocated-dialog";
import { ViewTeamMembersDialog } from "./view-team-members-dialog";
import { TeamInviteDialog } from "./team-invite-dialog";

import {
  useLeagueTeams,
  type TeamWithDetails,
  type TeamMember,
} from "@/hooks/use-league-teams";

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="rounded-lg border">
        <div className="p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24" />
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
// TeamsTable Component
// ============================================================================

interface TeamsTableProps {
  leagueId: string;
  isHost?: boolean;
  isGovernor?: boolean;
}

export function TeamsTable({ leagueId, isHost, isGovernor }: TeamsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [addMembersDialogOpen, setAddMembersDialogOpen] = React.useState(false);
  const [assignCaptainDialogOpen, setAssignCaptainDialogOpen] = React.useState(false);
  const [assignGovernorDialogOpen, setAssignGovernorDialogOpen] = React.useState(false);
  const [viewUnallocatedDialogOpen, setViewUnallocatedDialogOpen] = React.useState(false);
  const [viewTeamMembersDialogOpen, setViewTeamMembersDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const [selectedTeam, setSelectedTeam] = React.useState<TeamWithDetails | null>(null);
  const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
  const [pointsMap, setPointsMap] = React.useState<Map<string, number> | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [loadingTeamMembers, setLoadingTeamMembers] = React.useState(false);

  const canManageTeams = isHost || isGovernor;

  // Fetch teams data
  const {
    data,
    isLoading,
    error,
    refetch,
    createTeam,
    deleteTeam,
    assignMember,
    removeMember,
    assignCaptain,
    removeCaptain,
    assignGovernor,
    removeGovernor,
  } = useLeagueTeams(leagueId);

  // ============================================================================
  // Handlers
  // ============================================================================

  // Fetch leaderboard points map for the league so dialogs can show per-user points
  React.useEffect(() => {
    let mounted = true;
    async function fetchPoints() {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/leaderboard?full=true`);
        const json = await res.json();
        if (mounted && res.ok && json?.success && json.data?.individuals) {
          console.debug('[TeamsTable] leaderboard individuals count:', json.data.individuals.length);
          console.debug('[TeamsTable] sample individuals:', json.data.individuals.slice(0,5));
          const map = new Map<string, number>(
            json.data.individuals.map((i: any) => [String(i.user_id), Number(i.points || 0)])
          );
          console.debug('[TeamsTable] built pointsMap size:', map.size);
          setPointsMap(map);
        }
      } catch (err) {
        console.error('Error fetching leaderboard points:', err);
      }
    }

    if (leagueId) fetchPoints();
    return () => {
      mounted = false;
    };
  }, [leagueId]);


  const handleCreateTeam = async (teamName: string): Promise<boolean> => {
    const success = await createTeam(teamName);
    if (success) {
      toast.success(`Team "${teamName}" created successfully`);
    } else {
      toast.error("Failed to create team");
    }
    return success;
  };

  const handleDeleteClick = (team: TeamWithDetails) => {
    setSelectedTeam(team);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTeam) return;

    setIsDeleting(true);
    const success = await deleteTeam(selectedTeam.team_id);
    setIsDeleting(false);

    if (success) {
      toast.success(`Team "${selectedTeam.team_name}" deleted successfully`);
      setDeleteDialogOpen(false);
      setSelectedTeam(null);
    } else {
      toast.error("Failed to delete team");
    }
  };

  const handleAddMembersClick = (team: TeamWithDetails) => {
    setSelectedTeam(team);
    setAddMembersDialogOpen(true);
  };

  const handleViewTeamMembersClick = async (team: TeamWithDetails) => {
    setSelectedTeam(team);
    setLoadingTeamMembers(true);
    setViewTeamMembersDialogOpen(true);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/teams/${team.team_id}/members`);
      const result = await response.json();
      if (result.success) {
          console.debug('[TeamsTable] fetched team members count:', (result.data || []).length);
          const membersWithPoints = (result.data || []).map((m: any) => ({
            ...m,
            points: pointsMap?.get(String(m.user_id)) ?? 0,
          }));
          console.debug('[TeamsTable] membersWithPoints sample:', membersWithPoints.slice(0,5));
          setTeamMembers(membersWithPoints as TeamMember[]);
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    } finally {
      setLoadingTeamMembers(false);
    }
  };

  const handleAssignCaptainClick = async (team: TeamWithDetails) => {
    setSelectedTeam(team);
    setLoadingTeamMembers(true);

    try {
      // Fetch team members for captain selection
      const response = await fetch(`/api/leagues/${leagueId}/teams/${team.team_id}/members`);
      const result = await response.json();
      if (result.success) {
        const membersWithPoints = (result.data || []).map((m: any) => ({
          ...m,
          points: pointsMap?.get(String(m.user_id)) ?? 0,
        }));
        setTeamMembers(membersWithPoints as TeamMember[]);
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    } finally {
      setLoadingTeamMembers(false);
      setAssignCaptainDialogOpen(true);
    }
  };

  const handleAddMember = async (teamId: string, leagueMemberId: string): Promise<boolean> => {
    const success = await assignMember(teamId, leagueMemberId);
    if (success) {
      toast.success("Member added to team");
    } else {
      toast.error("Failed to add member");
    }
    return success;
  };

  const handleAssignCaptain = async (teamId: string, userId: string): Promise<boolean> => {
    const success = await assignCaptain(teamId, userId);
    if (success) {
      toast.success("Captain assigned successfully");
    } else {
      toast.error("Failed to assign captain");
    }
    return success;
  };

  const handleAssignGovernor = async (userId: string): Promise<boolean> => {
    const success = await assignGovernor(userId);
    if (success) {
      toast.success("Governor assigned successfully");
    } else {
      toast.error("Failed to assign governor");
    }
    return success;
  };

  const handleRemoveGovernor = async (userId: string): Promise<boolean> => {
    const success = await removeGovernor(userId);
    if (success) {
      toast.success("Governor removed successfully");
    } else {
      toast.error("Failed to remove governor");
    }
    return success;
  };

  // ============================================================================
  // Table Columns
  // ============================================================================

  const columns: ColumnDef<TeamWithDetails>[] = [
    {
      accessorKey: "team_name",
      header: "Team",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.original.team_name}</div>
            <div className="text-sm text-muted-foreground">
              {row.original.member_count} / {data?.league.team_size || 0} members
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "captain",
      header: "Captain",
      cell: ({ row }) => {
        const captain = row.original.captain;
        if (!captain) {
          return (
            <span className="text-sm text-muted-foreground italic">
              No captain assigned
            </span>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {captain.username
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                <Crown className="size-2.5 text-white" />
              </div>
            </div>
            <span className="text-sm">{captain.username}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "member_count",
      header: "Members",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.member_count} / {data?.league.team_size || 0}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        if (!canManageTeams) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleViewTeamMembersClick(row.original)}>
                <Users className="mr-2 size-4" />
                View Members
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAddMembersClick(row.original)}>
                <UserPlus className="mr-2 size-4" />
                Add Members
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAssignCaptainClick(row.original)}>
                <Crown className="mr-2 size-4" />
                Assign Captain
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <TeamInviteDialog
                teamName={row.original.team_name}
                leagueName={data?.league.league_name || ""}
                inviteCode={row.original.invite_code || ""}
                memberCount={row.original.member_count}
                maxCapacity={data?.league.team_size || 5}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Share2 className="mr-2 size-4" />
                    Invite to Team
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDeleteClick(row.original)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete Team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // ============================================================================
  // Table Instance
  // ============================================================================

  const table = useReactTable({
    data: data?.teams || [],
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Team Management</h2>
          <p className="text-sm text-muted-foreground">
            {data?.meta.current_team_count || 0} of {data?.meta.max_teams || 0} teams created
          </p>
        </div>
        {canManageTeams && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewUnallocatedDialogOpen(true)}>
              <Users className="mr-2 size-4" />
              Unallocated ({data?.members.unallocated.length || 0})
            </Button>
            {isHost && (
              <Button variant="outline" onClick={() => setAssignGovernorDialogOpen(true)}>
                <Shield className="mr-2 size-4" />
                {data?.governors && data.governors.length > 0 ? "Manage Governors" : "Assign Governor"}
              </Button>
            )}
            <Button
              onClick={() => setCreateDialogOpen(true)}
              disabled={!data?.meta.can_create_more}
            >
              <Plus className="mr-2 size-4" />
              Create Team
            </Button>
          </div>
        )}
      </div>

      {/* Governors Info */}
      {data?.governors && data.governors.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Shield className="size-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">
              {data.governors.length === 1 ? 'Governor' : 'Governors'}: {data.governors.map(g => g.username).join(', ')}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.governors.length === 1 ? 'Has' : 'Have'} oversight of all teams and can validate any submission
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
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
                      <Users className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">No teams yet</p>
                      <p className="text-sm text-muted-foreground">
                        {error
                          ? "Unable to load teams. Please try again."
                          : "Create your first team to get started."}
                      </p>
                    </div>
                    {!error && canManageTeams && (
                      <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="mr-2 size-4" />
                        Create Team
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
      {(data?.teams.length || 0) > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} team(s) total
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

      {/* Dialogs */}
      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateTeam}
        currentCount={data?.meta.current_team_count || 0}
        maxTeams={data?.meta.max_teams || 0}
      />

      {selectedTeam && (
        <AddMembersDialog
          open={addMembersDialogOpen}
          onOpenChange={setAddMembersDialogOpen}
          teamId={selectedTeam.team_id}
          teamName={selectedTeam.team_name}
          teamSize={data?.league.team_size || 0}
          currentMemberCount={selectedTeam.member_count}
          unallocatedMembers={(data?.members.unallocated || []).map((m: any) => ({
            ...m,
            points: pointsMap?.get(String(m.user_id)) ?? 0,
          }))}
          onAddMember={handleAddMember}
        />
      )}

      {selectedTeam && (
        <AssignCaptainDialog
          open={assignCaptainDialogOpen}
          onOpenChange={setAssignCaptainDialogOpen}
          teamId={selectedTeam.team_id}
          teamName={selectedTeam.team_name}
          members={teamMembers}
          currentCaptain={
            teamMembers.find((m) => m.is_captain) || null
          }
          onAssignCaptain={handleAssignCaptain}
        />
      )}

      <AssignGovernorDialog
        open={assignGovernorDialogOpen}
        onOpenChange={setAssignGovernorDialogOpen}
        members={[...(data?.members.allocated || []), ...(data?.members.unallocated || [])].map((m: any) => ({
          ...m,
          points: pointsMap?.get(String(m.user_id)) ?? 0,
        }))}
        currentGovernors={data?.governors || []}
        hostUserId={data?.league.host_user_id || ""}
        onAssignGovernor={handleAssignGovernor}
        onRemoveGovernor={handleRemoveGovernor}
      />

      <ViewUnallocatedDialog
        open={viewUnallocatedDialogOpen}
        onOpenChange={setViewUnallocatedDialogOpen}
        members={(data?.members.unallocated || []).map((m: any) => ({
          ...m,
          points: pointsMap?.get(String(m.user_id)) ?? 0,
        }))}
      />

      {selectedTeam && (
        <ViewTeamMembersDialog
          open={viewTeamMembersDialogOpen}
          onOpenChange={setViewTeamMembersDialogOpen}
          teamName={selectedTeam.team_name}
          members={teamMembers}
          isLoading={loadingTeamMembers}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTeam?.team_name}"? All members
              will be unassigned and moved to the unallocated pool. This action cannot
              be undone.
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
    </div>
  );
}

export default TeamsTable;
