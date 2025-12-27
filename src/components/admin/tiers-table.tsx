"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TierFormDialog } from "./tier-form-dialog";
import { useAdminTiers } from "@/hooks/admin/use-admin-tiers";
import type { AdminTier, AdminTierCreateInput, TierPricingType } from "@/types/admin";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function PricingBadge({ type }: { type: TierPricingType }) {
  const label = type === "fixed" ? "Fixed" : "Dynamic";
  return <Badge variant="outline" className={type === "fixed" ? "border-blue-400 text-blue-700" : "border-amber-400 text-amber-700"}>{label}</Badge>;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant="outline" className={active ? "border-green-500 text-green-700" : "border-gray-300 text-gray-600"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function TiersSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-40" />
      {Array.from({ length: 3 }).map((_, idx) => (
        <Card key={idx}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TierRow({ tier, onEdit, onDelete, onToggleActive }: {
  tier: AdminTier;
  onEdit: (tier: AdminTier) => void;
  onDelete: (tier: AdminTier) => void;
  onToggleActive: (tier: AdminTier) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-3">
            <span>{tier.display_name}</span>
            <PricingBadge type={tier.pricing_type} />
            <StatusBadge active={tier.is_active} />
            {tier.is_featured ? <Badge variant="secondary">Featured</Badge> : null}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{tier.description || "No description"}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(tier)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onToggleActive(tier)}>
            {tier.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(tier)}>
            Delete
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">Max Days: {tier.max_days}</Badge>
          <Badge variant="outline">Max Participants: {tier.max_participants}</Badge>
          <Badge variant="outline">Order: {tier.display_order ?? 0}</Badge>
          {tier.active_leagues !== undefined ? (
            <Badge variant="outline">Active Leagues: {tier.active_leagues}</Badge>
          ) : null}
          {tier.total_leagues !== undefined ? (
            <Badge variant="outline">Total Leagues: {tier.total_leagues}</Badge>
          ) : null}
        </div>
        <Separator />
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
          {tier.pricing_type === "fixed" ? (
            <div>
              <Label className="text-xs text-muted-foreground">Fixed Price</Label>
              <div className="font-medium">₹{(tier.fixed_price ?? 0).toFixed(2)}</div>
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs text-muted-foreground">Base Fee</Label>
                <div className="font-medium">₹{(tier.base_fee ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Per Day</Label>
                <div className="font-medium">₹{(tier.per_day_rate ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Per Participant</Label>
                <div className="font-medium">₹{(tier.per_participant_rate ?? 0).toFixed(2)}</div>
              </div>
            </>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">GST</Label>
            <div className="font-medium">{(tier.gst_percentage ?? 18).toFixed(1)}%</div>
          </div>
        </div>
        {tier.features && tier.features.length ? (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Features: </span>
            {tier.features.join(", ")}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TiersTable() {
  const { tiers, isLoading, error, createTier, updateTier, deleteTier, refetch } = useAdminTiers();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTier, setEditingTier] = React.useState<AdminTier | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminTier | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleCreate = () => {
    setEditingTier(null);
    setDialogOpen(true);
  };

  const handleSave = async (data: AdminTierCreateInput, existingId?: string) => {
    const payload = {
      name: data.name,
      display_name: data.display_name,
      description: data.description,
      pricing_type: data.pricing_type,
      fixed_price: data.fixed_price,
      base_fee: data.base_fee,
      per_day_rate: data.per_day_rate,
      per_participant_rate: data.per_participant_rate,
      gst_percentage: data.gst_percentage,
      max_days: data.max_days,
      max_participants: data.max_participants,
      display_order: data.display_order,
      is_featured: data.is_featured,
      features: data.features || [],
    };

    if (existingId) {
      const updated = await updateTier(existingId, payload);
      if (updated) {
        toast.success("Tier updated");
      } else {
        toast.error("Failed to update tier");
      }
    } else {
      const created = await createTier(payload);
      if (created) {
        toast.success("Tier created");
      } else {
        toast.error("Failed to create tier");
      }
    }
  };

  const handleEdit = (tier: AdminTier) => {
    setEditingTier(tier);
    setDialogOpen(true);
  };

  const handleToggleActive = async (tier: AdminTier) => {
    const updated = await updateTier(tier.id, { is_active: !tier.is_active });
    if (updated) {
      toast.success(`Tier ${!tier.is_active ? "activated" : "deactivated"}`);
    } else {
      toast.error("Failed to update tier status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const ok = await deleteTier(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
    if (ok) {
      toast.success("Tier deleted");
    } else {
      toast.error("Failed to delete tier");
    }
  };

  if (isLoading) return <TiersSkeleton />;
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={refetch} className="mt-2">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">League Tiers</h1>
          <p className="text-muted-foreground">Configure tier limits and pricing (fixed or dynamic)</p>
        </div>
        <Button onClick={handleCreate}>Add Tier</Button>
      </div>

      <div className="space-y-4">
        {tiers.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-muted-foreground">No tiers yet. Create one to get started.</CardContent>
          </Card>
        ) : (
          tiers.map((tier) => (
            <TierRow
              key={tier.id}
              tier={tier}
              onEdit={handleEdit}
              onDelete={(t) => setDeleteTarget(t)}
              onToggleActive={handleToggleActive}
            />
          ))
        )}
      </div>

      <TierFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (payload) => {
          await handleSave(payload, editingTier?.id);
        }}
        initialTier={editingTier}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tier?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">
            This action is irreversible. If the tier is referenced by leagues, the API will reject the deletion.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
