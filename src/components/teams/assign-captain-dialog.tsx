"use client";

import * as React from "react";
import { Loader2, Crown, Search } from "lucide-react";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { TeamMember } from "@/hooks/use-league-teams";

interface AssignCaptainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  members: TeamMember[];
  currentCaptain: TeamMember | null;
  onAssignCaptain: (teamId: string, userId: string) => Promise<boolean>;
}

export function AssignCaptainDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  members,
  currentCaptain,
  onAssignCaptain,
}: AssignCaptainDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedUserId(currentCaptain?.user_id || null);
    }
  }, [open, currentCaptain]);

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.username.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const handleAssign = async () => {
    if (!selectedUserId || selectedUserId === currentCaptain?.user_id) {
      onOpenChange(false);
      return;
    }

    setIsLoading(true);
    try {
      const success = await onAssignCaptain(teamId, selectedUserId);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            Assign Captain for {teamName}
          </DialogTitle>
          <DialogDescription>
            Select a team member to be the captain. The captain can validate
            submissions from team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Members List */}
          <ScrollArea className="h-[280px] rounded-md border">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Crown className="size-10 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No team members</p>
                <p className="text-xs text-muted-foreground">
                  Add members to the team first
                </p>
              </div>
            ) : (
              <RadioGroup
                value={selectedUserId || ""}
                onValueChange={setSelectedUserId}
                className="p-2 space-y-1"
              >
                {filteredMembers.map((member) => {
                  const isCurrent = member.user_id === currentCaptain?.user_id;

                  return (
                    <div
                      key={member.user_id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedUserId === member.user_id
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem
                        value={member.user_id}
                        id={member.user_id}
                      />
                      <Label
                        htmlFor={member.user_id}
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                      >
                        <div className="relative">
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
                          {isCurrent && (
                            <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                              <Crown className="size-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {member.username}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            Points: {(member as any).points ?? 0}
                          </p>
                        </div>
                        {isCurrent && (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">
                            Current Captain
                          </Badge>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isLoading || !selectedUserId || members.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Crown className="mr-2 size-4" />
                Assign Captain
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignCaptainDialog;
