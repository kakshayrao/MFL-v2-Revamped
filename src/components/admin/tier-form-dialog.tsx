"use client";

import * as React from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminTier, AdminTierCreateInput, TierPricingType } from "@/types/admin";

const TierSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores"),
  display_name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  pricing_type: z.enum(["fixed", "dynamic"]),
  fixed_price: z.number().min(0).nullable().optional(),
  base_fee: z.number().min(0).nullable().optional(),
  per_day_rate: z.number().min(0).nullable().optional(),
  per_participant_rate: z.number().min(0).nullable().optional(),
  gst_percentage: z.number().min(0).max(100).default(18),
  max_days: z.number().int().min(1).max(365),
  max_participants: z.number().int().min(1).max(10000),
  display_order: z.number().int().min(0).optional(),
  is_featured: z.boolean().optional(),
  features: z.array(z.string()).optional(),
});

export interface TierFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AdminTierCreateInput) => Promise<void>;
  initialTier?: AdminTier | null;
}

export function TierFormDialog({ open, onClose, onSubmit, initialTier }: TierFormDialogProps) {
  const [saving, setSaving] = React.useState(false);
  const [pricingType, setPricingType] = React.useState<TierPricingType>(initialTier?.pricing_type || "fixed");
  const [featuresText, setFeaturesText] = React.useState(
    (initialTier?.features || []).join(", ")
  );

  const [form, setForm] = React.useState<AdminTierCreateInput>({
    name: initialTier?.name || "",
    display_name: initialTier?.display_name || "",
    description: initialTier?.description || "",
    pricing_type: initialTier?.pricing_type || "fixed",
    fixed_price: initialTier?.fixed_price ?? null,
    base_fee: initialTier?.base_fee ?? 0,
    per_day_rate: initialTier?.per_day_rate ?? 0,
    per_participant_rate: initialTier?.per_participant_rate ?? 0,
    gst_percentage: initialTier?.gst_percentage ?? 18,
    max_days: initialTier?.max_days || 30,
    max_participants: initialTier?.max_participants || 100,
    display_order: initialTier?.display_order ?? 0,
    is_featured: initialTier?.is_featured ?? false,
    features: initialTier?.features || [],
  });

  React.useEffect(() => {
    setPricingType(initialTier?.pricing_type || "fixed");
    setFeaturesText((initialTier?.features || []).join(", "));
    setForm({
      name: initialTier?.name || "",
      display_name: initialTier?.display_name || "",
      description: initialTier?.description || "",
      pricing_type: initialTier?.pricing_type || "fixed",
      fixed_price: initialTier?.fixed_price ?? null,
      base_fee: initialTier?.base_fee ?? 0,
      per_day_rate: initialTier?.per_day_rate ?? 0,
      per_participant_rate: initialTier?.per_participant_rate ?? 0,
      gst_percentage: initialTier?.gst_percentage ?? 18,
      max_days: initialTier?.max_days || 30,
      max_participants: initialTier?.max_participants || 100,
      display_order: initialTier?.display_order ?? 0,
      is_featured: initialTier?.is_featured ?? false,
      features: initialTier?.features || [],
    });
  }, [initialTier]);

  const handleNumber = (value: string) => (value === "" ? 0 : Number(value));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const featureList = featuresText
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const candidate: AdminTierCreateInput = {
        ...form,
        pricing_type: pricingType,
        features: featureList,
        fixed_price: form.fixed_price ?? null,
        base_fee: form.base_fee ?? 0,
        per_day_rate: form.per_day_rate ?? 0,
        per_participant_rate: form.per_participant_rate ?? 0,
      };

      const parsed = TierSchema.safeParse({ ...candidate, features: featureList });
      if (!parsed.success) {
        const first = parsed.error.errors[0];
        toast.error(first?.message || "Please fix validation errors");
        return;
      }

      if (pricingType === "fixed" && (!candidate.fixed_price || candidate.fixed_price <= 0)) {
        toast.error("Fixed pricing requires a fixed price greater than 0");
        return;
      }

      if (pricingType === "dynamic") {
        const hasComponent =
          (candidate.base_fee ?? 0) > 0 ||
          (candidate.per_day_rate ?? 0) > 0 ||
          (candidate.per_participant_rate ?? 0) > 0;
        if (!hasComponent) {
          toast.error("Dynamic pricing needs base fee, per-day, or per-participant to be > 0");
          return;
        }
      }

      await onSubmit(candidate);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tier");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialTier ? "Edit Tier" : "Create Tier"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4 grid-cols-1 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">System Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. standard_tier"
            />
            <p className="text-xs text-muted-foreground">Lowercase, underscores allowed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="e.g. Standard"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Short description"
            />
          </div>

          <div className="space-y-2">
            <Label>Pricing Type</Label>
            <Select value={pricingType} onValueChange={(val) => setPricingType(val as TierPricingType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="dynamic">Dynamic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fixed_price">Fixed Price (₹)</Label>
            <Input
              id="fixed_price"
              type="number"
              value={form.fixed_price ?? ""}
              onChange={(e) => setForm({ ...form, fixed_price: handleNumber(e.target.value) })}
              disabled={pricingType !== "fixed"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base_fee">Base Fee (₹)</Label>
            <Input
              id="base_fee"
              type="number"
              value={form.base_fee ?? 0}
              onChange={(e) => setForm({ ...form, base_fee: handleNumber(e.target.value) })}
              disabled={pricingType !== "dynamic"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="per_day_rate">Per Day Rate (₹)</Label>
            <Input
              id="per_day_rate"
              type="number"
              value={form.per_day_rate ?? 0}
              onChange={(e) => setForm({ ...form, per_day_rate: handleNumber(e.target.value) })}
              disabled={pricingType !== "dynamic"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="per_participant_rate">Per Participant Rate (₹)</Label>
            <Input
              id="per_participant_rate"
              type="number"
              value={form.per_participant_rate ?? 0}
              onChange={(e) => setForm({ ...form, per_participant_rate: handleNumber(e.target.value) })}
              disabled={pricingType !== "dynamic"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gst_percentage">GST (%)</Label>
            <Input
              id="gst_percentage"
              type="number"
              value={form.gst_percentage ?? 18}
              onChange={(e) => setForm({ ...form, gst_percentage: handleNumber(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_days">Max Days</Label>
            <Input
              id="max_days"
              type="number"
              value={form.max_days}
              onChange={(e) => setForm({ ...form, max_days: handleNumber(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_participants">Max Participants</Label>
            <Input
              id="max_participants"
              type="number"
              value={form.max_participants}
              onChange={(e) => setForm({ ...form, max_participants: handleNumber(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_order">Display Order</Label>
            <Input
              id="display_order"
              type="number"
              value={form.display_order ?? 0}
              onChange={(e) => setForm({ ...form, display_order: handleNumber(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="is_featured">
              <span>Featured</span>
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                id="is_featured"
                checked={!!form.is_featured}
                onCheckedChange={(checked) => setForm({ ...form, is_featured: checked })}
              />
              <span className="text-sm text-muted-foreground">Show prominently in selection</span>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="features">Features (comma-separated)</Label>
            <Input
              id="features"
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder="e.g. Daily leaderboard, Coach support"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {initialTier ? "Save Changes" : "Create Tier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
