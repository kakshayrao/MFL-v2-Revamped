"use client";

import * as React from "react";
import { Users, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LeagueMember } from "@/hooks/use-league-teams";

interface ViewUnallocatedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: LeagueMember[];
}

export function ViewUnallocatedDialog({
  open,
  onOpenChange,
  members,
}: ViewUnallocatedDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
    }
  }, [open]);

  // Points (if present) should be merged into member objects by the parent.

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.username.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-orange-500" />
            Unallocated Members
          </DialogTitle>
          <DialogDescription>
            These members have joined the league but are not yet assigned to any team.
            {members.length > 0 && ` (${members.length} total)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Members List */}
          <ScrollArea className="h-[350px] rounded-md border">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Users className="size-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {members.length === 0 ? "No unallocated members" : "No members match your search"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {members.length === 0
                    ? "All members have been assigned to teams"
                    : "Try a different search term"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.league_member_id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="size-10">
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
                    <div className="flex items-center gap-1">
                      {member.roles
                        .filter((r) => r !== "player")
                        .map((role) => (
                          <Badge
                            key={role}
                            variant="outline"
                            className={
                              role === "governor"
                                ? "bg-blue-500/10 text-blue-600 border-blue-200"
                                : role === "captain"
                                ? "bg-amber-500/10 text-amber-600 border-amber-200"
                                : role === "host"
                                ? "bg-purple-500/10 text-purple-600 border-purple-200"
                                : ""
                            }
                          >
                            {role}
                          </Badge>
                        ))}
                      <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-200">
                        Unallocated
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ViewUnallocatedDialog;
