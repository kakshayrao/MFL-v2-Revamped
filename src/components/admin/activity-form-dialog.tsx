"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import type { AdminActivity } from "@/types/admin";

// ============================================================================
// Types
// ============================================================================

interface ActivityFormData {
  activity_name: string;
  description: string;
  category_id: string | "";
}

interface ActivityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: AdminActivity | null;
  onSubmit: (data: ActivityFormData) => void | Promise<void>;
}

// ============================================================================
// ActivityFormDialog Component
// ============================================================================

export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  onSubmit,
}: ActivityFormDialogProps) {
  const isEditing = !!activity;
  const [isLoading, setIsLoading] = React.useState(false);
  const [categories, setCategories] = React.useState<
    { category_id: string; display_name: string; category_name: string }[]
  >([]);
  const [isCatLoading, setIsCatLoading] = React.useState(false);
  const [newCatOpen, setNewCatOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [newCatDesc, setNewCatDesc] = React.useState("");

  const [formData, setFormData] = React.useState<ActivityFormData>({
    activity_name: "",
    description: "",
    category_id: "",
  });

  React.useEffect(() => {
    if (open && activity) {
      setFormData({
        activity_name: activity.activity_name,
        description: activity.description || "",
        category_id: activity.category_id || "",
      });
    } else if (open && !activity) {
      setFormData({
        activity_name: "",
        description: "",
        category_id: "",
      });
    }
  }, [activity, open]);

  React.useEffect(() => {
    if (!open) return;
    const load = async () => {
      setIsCatLoading(true);
      try {
        const res = await fetch("/api/admin/activity-categories");
        const json = await res.json();
        if (res.ok && Array.isArray(json.data)) setCategories(json.data);
        else setCategories([]);
      } catch {
        setCategories([]);
      } finally {
        setIsCatLoading(false);
      }
    };
    load();
  }, [open]);

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Activity" : "Create Activity"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the activity details below."
              : "Fill in the details to create a new activity."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activity_name">Activity Name *</Label>
              <Input
                id="activity_name"
                value={formData.activity_name}
                onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
                placeholder="Running"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the activity..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewCatOpen(true)}>
                  + New Category
                </Button>
              </div>
              <div>
                <select
                  id="category"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  disabled={isCatLoading}
                  required
                >
                  <option value="" disabled>Select a category</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.display_name || c.category_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.category_id}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update Activity"
              ) : (
                "Create Activity"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {/* New Category Dialog */}
      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>Define a new activity category.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newCatName">Display Name *</Label>
              <Input id="newCatName" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCatDesc">Description</Label>
              <Textarea id="newCatDesc" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewCatOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!newCatName.trim()) return;
                const res = await fetch('/api/admin/activity-categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ display_name: newCatName.trim(), description: newCatDesc || null })
                });
                const json = await res.json();
                if (res.ok && json?.data?.category_id) {
                  // refresh categories
                  try {
                    const r = await fetch('/api/admin/activity-categories');
                    const j = await r.json();
                    if (r.ok && Array.isArray(j.data)) setCategories(j.data);
                  } catch {}
                  setFormData((prev) => ({ ...prev, category_id: json.data.category_id as string }));
                  setNewCatOpen(false);
                  setNewCatName('');
                  setNewCatDesc('');
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default ActivityFormDialog;
