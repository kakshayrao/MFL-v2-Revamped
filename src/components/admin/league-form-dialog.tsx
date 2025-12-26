"use client";

import * as React from "react";
import { Loader2, AlertCircle } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AdminLeague, LeagueStatus } from "@/types/admin";

// ============================================================================
// Types
// ============================================================================

interface LeagueFormData {
  league_name: string;
  description: string;
  start_date: string;
  end_date: string;
  num_teams: number;
  rest_days: number;
  auto_rest_day_enabled: boolean;
  is_public: boolean;
  is_exclusive: boolean;
  status: LeagueStatus;
  is_active: boolean;
}

interface LeagueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  league?: AdminLeague | null;
  onSubmit: (data: LeagueFormData) => void | Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const STATUSES: { value: LeagueStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "launched", label: "Launched" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

// ============================================================================
// LeagueFormDialog Component
// ============================================================================

export function LeagueFormDialog({
  open,
  onOpenChange,
  league,
  onSubmit,
}: LeagueFormDialogProps) {
  const isEditing = !!league;
  const [isLoading, setIsLoading] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState<LeagueFormData>({
    league_name: "",
    description: "",
    start_date: "",
    end_date: "",
    num_teams: 4,
    rest_days: 1,
    auto_rest_day_enabled: false,
    is_public: false,
    is_exclusive: true,
    status: "draft",
    is_active: true,
  });

  // Reset form when dialog opens/closes or league changes
  React.useEffect(() => {
    if (open && league) {
      setFormData({
        league_name: league.league_name,
        description: league.description || "",
        start_date: league.start_date,
        end_date: league.end_date,
        num_teams: league.num_teams,
        rest_days: league.rest_days,
        auto_rest_day_enabled: league.auto_rest_day_enabled,
        is_public: league.is_public,
        is_exclusive: league.is_exclusive,
        status: league.status,
        is_active: league.is_active,
      });
    } else if (open && !league) {
      setFormData({
        league_name: "",
        description: "",
        start_date: "",
        end_date: "",
        num_teams: 4,
        rest_days: 1,
        auto_rest_day_enabled: false,
        is_public: false,
        is_exclusive: true,
        status: "draft",
        is_active: true,
      });
    }
  }, [open, league]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onSubmit(formData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit League" : "Create New League"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the league details below."
              : "Fill in the details to create a new league."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* League Name */}
          <div className="space-y-2">
            <Label htmlFor="league_name">League Name *</Label>
            <Input
              id="league_name"
              placeholder="Summer Fitness Challenge"
              value={formData.league_name}
              onChange={(e) => setFormData({ ...formData, league_name: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your league..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date *</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Team Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="num_teams">Number of Teams</Label>
              <Input
                id="num_teams"
                type="number"
                min={2}
                max={20}
                value={formData.num_teams}
                onChange={(e) =>
                  setFormData({ ...formData, num_teams: parseInt(e.target.value) || 4 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rest_days">Rest Days</Label>
              <Input
                id="rest_days"
                type="number"
                min={0}
                max={7}
                value={formData.rest_days}
                onChange={(e) =>
                  setFormData({ ...formData, rest_days: parseInt(e.target.value) || 1 })
                }
              />
            </div>
          </div>

          {/* Status (only for editing) */}
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: LeagueStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Visibility Settings */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_public">Public League</Label>
                <p className="text-sm text-muted-foreground">
                  Anyone can find and join this league
                </p>
              </div>
              <Switch
                id="is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_exclusive">Exclusive Entry</Label>
                <p className="text-sm text-muted-foreground">
                  Users need an invite code to join
                </p>
              </div>
              <Switch
                id="is_exclusive"
                checked={formData.is_exclusive}
                onCheckedChange={(checked) => setFormData({ ...formData, is_exclusive: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto_rest_day_enabled">Auto Rest Day Assignment</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically mark missing submissions as rest days (via cron)
                </p>
              </div>
              <Switch
                id="auto_rest_day_enabled"
                checked={formData.auto_rest_day_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_rest_day_enabled: checked })}
              />
            </div>

            {isEditing && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    League is visible and accessible
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            )}

          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update League"
              ) : (
                "Create League"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LeagueFormDialog;
