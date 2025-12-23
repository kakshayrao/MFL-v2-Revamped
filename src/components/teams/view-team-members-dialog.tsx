"use client";

import * as React from "react";
import { Users, Crown, Search } from "lucide-react";

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
import type { TeamMember } from "@/hooks/use-league-teams";

interface ViewTeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  members: (TeamMember & { points?: number })[];
  isLoading?: boolean;
}

export function ViewTeamMembersDialog({
  open,
  onOpenChange,
  teamName,
  members,
  isLoading,
}: ViewTeamMembersDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
    }
  }, [open]);

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.username.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const captain = members.find((m) => m.is_captain);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            {teamName} - Members
          </DialogTitle>
          <DialogDescription>
            {members.length > 0
              ? `${members.length} member${members.length !== 1 ? "s" : ""} in this team`
              : "No members in this team yet"}
            {captain && ` | Captain: ${captain.username}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          {members.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Members List */}
          <ScrollArea className="h-[350px] rounded-md border">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground mt-2">Loading members...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Users className="size-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  {members.length === 0 ? "No members yet" : "No members match your search"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {members.length === 0
                    ? "Add members to this team to get started"
                    : "Try a different search term"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.league_member_id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      member.is_captain
                        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                        : "bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="relative">
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
                      {member.is_captain && (
                        <div className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                          <Crown className="size-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.username}
                        {member.is_captain && (
                          <span className="text-amber-600 ml-1">(Captain)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Points: {(member as any).points ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {member.roles
                        .filter((r) => r !== "player" && r !== "captain")
                        .map((role) => (
                          <Badge
                            key={role}
                            variant="outline"
                            className={
                              role === "governor"
                                ? "bg-blue-500/10 text-blue-600 border-blue-200"
                                : role === "host"
                                ? "bg-purple-500/10 text-purple-600 border-purple-200"
                                : ""
                            }
                          >
                            {role}
                          </Badge>
                        ))}
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

export default ViewTeamMembersDialog;
