"use client";

import * as React from "react";
import { Loader2, Search, UserPlus, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import type { LeagueMember } from "@/hooks/use-league-teams";

interface AddMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  teamCapacity: number;
  currentMemberCount: number;
  unallocatedMembers: LeagueMember[];
  onAddMember: (teamId: string, leagueMemberId: string) => Promise<boolean>;
}

export function AddMembersDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  teamCapacity,
  currentMemberCount,
  unallocatedMembers,
  onAddMember,
}: AddMembersDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMembers, setSelectedMembers] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [addingMemberId, setAddingMemberId] = React.useState<string | null>(null);

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedMembers([]);
    }
  }, [open]);

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return unallocatedMembers;
    const query = searchQuery.toLowerCase();
    return unallocatedMembers.filter(
      (m) =>
        m.username.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [unallocatedMembers, searchQuery]);

  const remainingSlots = teamCapacity - currentMemberCount;
  const canAddMore = remainingSlots > 0;

  const handleAddMember = async (memberId: string) => {
    if (!canAddMore) return;

    setAddingMemberId(memberId);
    try {
      const success = await onAddMember(teamId, memberId);
      if (success) {
        // Remove from local list immediately for better UX
        setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
      }
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleAddSelected = async () => {
    if (selectedMembers.length === 0) return;

    setIsLoading(true);
    try {
      for (const memberId of selectedMembers) {
        if (currentMemberCount + selectedMembers.indexOf(memberId) >= teamCapacity) break;
        await onAddMember(teamId, memberId);
      }
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Members to {teamName}</DialogTitle>
          <DialogDescription>
            Select unallocated players to add to this team.{" "}
            {remainingSlots > 0 ? (
              <span className="text-green-600">
                {remainingSlots} slot{remainingSlots !== 1 ? "s" : ""} remaining
              </span>
            ) : (
              <span className="text-destructive">Team is full</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Members List */}
          <ScrollArea className="h-[300px] rounded-md border">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <UserPlus className="size-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No unallocated players</p>
                <p className="text-xs text-muted-foreground">
                  All players have been assigned to teams
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((member) => {
                  const isSelected = selectedMembers.includes(member.league_member_id);
                  const isAdding = addingMemberId === member.league_member_id;

                  return (
                    <div
                      key={member.league_member_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(member.league_member_id)}
                        disabled={!canAddMore && !isSelected}
                      />
                      <Avatar className="size-9">
                        <AvatarFallback>
                          {member.username
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {member.username}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          Points: {(member as any).points ?? 0}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAddMember(member.league_member_id)}
                          disabled={!canAddMore || isAdding}
                        >
                          {isAdding ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <UserPlus className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <p className="text-sm text-muted-foreground">
              {selectedMembers.length} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSelected}
                disabled={
                  isLoading || selectedMembers.length === 0 || !canAddMore
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-4" />
                    Add Selected
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddMembersDialog;
