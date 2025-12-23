"use client";

import * as React from "react";
import { toast } from "sonner";

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

// ============================================================================
// Types
// ============================================================================

export interface Challenge {
  id: number;
  name: string;
  description: string;
  type: "streak" | "count" | "cumulative";
  challengeType: "individual" | "team" | "sub_team";
  category: string;
  difficulty: "easy" | "medium" | "hard";
  status: "active" | "upcoming" | "completed" | "draft";
  points: number;
  duration: number;
  startDate: string;
  endDate: string;
  participants: number;
  completions: number;
}

interface ChallengeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  onSubmit: (data: Partial<Challenge>) => void;
}

type ChallengeFormData = {
  name: string;
  description: string;
  type: Challenge["type"];
  challengeType: Challenge["challengeType"];
  category: string;
  difficulty: Challenge["difficulty"];
  status: Challenge["status"];
  points: number;
  duration: number;
  startDate: string;
  endDate: string;
};

// ============================================================================
// ChallengeFormDialog Component
// ============================================================================

export function ChallengeFormDialog({
  open,
  onOpenChange,
  challenge,
  onSubmit,
}: ChallengeFormDialogProps) {
  const isEditing = !!challenge;

  const [formData, setFormData] = React.useState<ChallengeFormData>({
    name: "",
    description: "",
    type: "streak",
    challengeType: "individual",
    category: "cardio",
    difficulty: "medium",
    status: "draft",
    points: 100,
    duration: 7,
    startDate: "",
    endDate: "",
  });

  React.useEffect(() => {
    if (challenge) {
      setFormData({
        name: challenge.name,
        description: challenge.description,
        type: challenge.type,
        challengeType: challenge.challengeType,
        category: challenge.category,
        difficulty: challenge.difficulty,
        status: challenge.status,
        points: challenge.points,
        duration: challenge.duration,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        type: "streak",
        challengeType: "individual",
        category: "cardio",
        difficulty: "medium",
        status: "draft",
        points: 100,
        duration: 7,
        startDate: "",
        endDate: "",
      });
    }
  }, [challenge, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    onSubmit({
      ...(challenge && { id: challenge.id }),
      ...formData,
      participants: challenge?.participants || 0,
      completions: challenge?.completions || 0,
    });

    toast.success(
      isEditing ? "Challenge updated successfully" : "Challenge created successfully"
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Challenge" : "Create Challenge"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the challenge details below."
              : "Fill in the details to create a new challenge."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Challenge Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="7-Day Cardio Streak"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Complete a cardio workout every day for 7 consecutive days"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "streak" | "count" | "cumulative") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="streak">Streak</SelectItem>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="cumulative">Cumulative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="challengeType">Challenge Type *</Label>
                <Select
                  value={formData.challengeType}
                  onValueChange={(value: "individual" | "team" | "sub_team") =>
                    setFormData({ ...formData, challengeType: value })
                  }
                >
                  <SelectTrigger id="challengeType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="sub_team">Sub-Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="steps">Steps</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="wellness">Wellness</SelectItem>
                    <SelectItem value="nutrition">Nutrition</SelectItem>
                    <SelectItem value="flexibility">Flexibility</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={(value: "easy" | "medium" | "hard") =>
                    setFormData({ ...formData, difficulty: value })
                  }
                >
                  <SelectTrigger id="difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "upcoming" | "completed" | "draft") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (days)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
