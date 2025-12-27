'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

type PresetChallenge = {
  challenge_id: string;
  name: string;
  description: string | null;
  challenge_type: 'individual' | 'team' | 'sub_team';
  doc_url: string | null;
  created_date: string;
};

type ChallengePricing = {
  pricing_id?: string;
  per_day_rate: number;
  tax: number | null;
  admin_markup: number | null;
};

export default function AdminChallengesPage() {
  const [loading, setLoading] = React.useState(true);
  const [challenges, setChallenges] = React.useState<PresetChallenge[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingChallenge, setEditingChallenge] = React.useState<PresetChallenge | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    challenge_type: 'individual' as 'individual' | 'team' | 'sub_team',
  });

  const [pricing, setPricing] = React.useState<ChallengePricing | null>(null);
  const [savingPricing, setSavingPricing] = React.useState(false);
  const [pricingEditMode, setPricingEditMode] = React.useState(true);

  const fetchChallenges = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/challenges');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load challenges');
      }
      setChallenges(json.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const fetchPricing = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/challenge-pricing');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load pricing');
      const data = json.data || { per_day_rate: 0, tax: null, admin_markup: null };
      setPricing(data);
      // If we already have pricing, default to view mode; otherwise allow editing
      setPricingEditMode(!data || data.per_day_rate === 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load pricing');
    }
  }, []);

  React.useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleOpenDialog = (challenge?: PresetChallenge) => {
    if (challenge) {
      setEditingChallenge(challenge);
      setFormData({
        name: challenge.name,
        description: challenge.description || '',
        challenge_type: challenge.challenge_type,
      });
    } else {
      setEditingChallenge(null);
      setFormData({
        name: '',
        description: '',
        challenge_type: 'individual',
      });
    }
    setSelectedFile(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let docUrl = editingChallenge?.doc_url || null;

      // Upload document if file selected
      if (selectedFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', selectedFile);

        const uploadRes = await fetch('/api/upload/challenge-document', {
          method: 'POST',
          body: formDataUpload,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Document upload failed');
        }

        docUrl = uploadData.data.url;
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        challenge_type: formData.challenge_type,
        doc_url: docUrl,
      };

      const url = editingChallenge
        ? `/api/admin/challenges/${editingChallenge.challenge_id}`
        : '/api/admin/challenges';

      const res = await fetch(url, {
        method: editingChallenge ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save challenge');
      }

      toast.success(editingChallenge ? 'Challenge updated' : 'Challenge created');
      setDialogOpen(false);
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save challenge');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this challenge?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/challenges/${id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete challenge');
      }

      toast.success('Challenge deleted');
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete challenge');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-4 lg:gap-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pre-configured Challenges
          </h1>
          <p className="text-muted-foreground">
            Manage challenge templates that leagues can activate
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 size-4" />
          Add Challenge
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Challenge Pricing</CardTitle>
              <CardDescription>
                Set the default per-day rate and tax (percentage) applied to challenges
              </CardDescription>
            </div>
            {!pricingEditMode && (
              <Button variant="secondary" size="sm" onClick={() => setPricingEditMode(true)}>
                Edit pricing
              </Button>
            )}
          </div>
        </CardHeader>

        {pricingEditMode ? (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Per-day rate</label>
                <Input
                  type="number"
                  value={pricing?.per_day_rate ?? ''}
                  onChange={(e) =>
                    setPricing((prev) => ({
                      ...(prev || { per_day_rate: 0, tax: null, admin_markup: null }),
                      per_day_rate: parseFloat(e.target.value) || 0,
                    }))
                  }
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tax (%)</label>
                <Input
                  type="number"
                  value={pricing?.tax ?? ''}
                  onChange={(e) =>
                    setPricing((prev) => ({
                      ...(prev || { per_day_rate: 0, tax: null, admin_markup: null }),
                      tax: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    }))
                  }
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Admin markup (%)</label>
                <Input
                  type="number"
                  value={pricing?.admin_markup ?? ''}
                  onChange={(e) =>
                    setPricing((prev) => ({
                      ...(prev || { per_day_rate: 0, tax: null, admin_markup: null }),
                      admin_markup: e.target.value === '' ? null : parseFloat(e.target.value) || 0,
                    }))
                  }
                  min={0}
                  step={0.01}
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!pricing) return;
                  setSavingPricing(true);
                  try {
                    const res = await fetch('/api/admin/challenge-pricing', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        per_day_rate: pricing.per_day_rate,
                        tax: pricing.tax ?? 0,
                        admin_markup: pricing.admin_markup ?? 0,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save pricing');
                    toast.success('Pricing saved');
                    setPricing(json.data);
                    setPricingEditMode(false);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to save pricing');
                  } finally {
                    setSavingPricing(false);
                  }
                }}
                disabled={savingPricing || !pricing}
              >
                {savingPricing ? 'Saving…' : 'Save pricing'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPricingEditMode(false)}
                disabled={savingPricing}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent className="space-y-4 bg-[#0d1930] text-white rounded-xl border border-primary/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold">Pricing</p>
                <p className="text-sm text-white/70">Current defaults applied to all challenges</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 text-sm pb-1">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 shadow-sm min-h-[84px] flex flex-col justify-center gap-1">
                <p className="text-white/60 text-[11px] uppercase tracking-wide">Per-day rate</p>
                <p className="text-lg font-semibold">₹{pricing?.per_day_rate?.toFixed ? pricing.per_day_rate.toFixed(2) : pricing?.per_day_rate ?? '—'}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 shadow-sm min-h-[84px] flex flex-col justify-center gap-1">
                <p className="text-white/60 text-[11px] uppercase tracking-wide">Tax</p>
                <p className="text-lg font-semibold">{pricing?.tax?.toFixed ? pricing.tax.toFixed(2) : pricing?.tax ?? 0}%</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 shadow-sm min-h-[84px] flex flex-col justify-center gap-1">
                <p className="text-white/60 text-[11px] uppercase tracking-wide">Admin markup</p>
                <p className="text-lg font-semibold">{pricing?.admin_markup?.toFixed ? pricing.admin_markup.toFixed(2) : pricing?.admin_markup ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {loading && <p className="text-muted-foreground">Loading...</p>}

      {!loading && challenges.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-3 text-muted-foreground size-12" />
            <p className="text-muted-foreground">No preset challenges yet.</p>
            <Button className="mt-4" onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 size-4" />
              Add First Challenge
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && challenges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Challenges</CardTitle>
            <CardDescription>
              {challenges.length} challenge{challenges.length !== 1 ? 's' : ''} available
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Rules</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challenges.map((challenge) => (
                  <TableRow key={challenge.challenge_id}>
                    <TableCell className="font-medium">{challenge.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {challenge.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {challenge.challenge_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {challenge.doc_url ? (
                        <a
                          href={challenge.doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                        >
                          <FileText className="size-3" />
                          View
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(challenge.created_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(challenge)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(challenge.challenge_id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChallenge ? 'Edit Challenge' : 'Add New Challenge'}
            </DialogTitle>
            <DialogDescription>
              {editingChallenge
                ? 'Update the challenge template'
                : 'Create a new pre-configured challenge that leagues can activate'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Challenge Type</Label>
              <Select
                value={formData.challenge_type}
                onValueChange={(val) =>
                  setFormData((p) => ({
                    ...p,
                    challenge_type: val as 'individual' | 'team' | 'sub_team',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="sub_team">Sub-team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-upload">Challenge Rules Document (Optional)</Label>
              <Input
                id="doc-upload"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Upload rules as PDF, Word document, or image (max 10MB)
              </p>
              {editingChallenge?.doc_url && !selectedFile && (
                <a
                  href={editingChallenge.doc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <FileText className="size-3" />
                  Current document
                </a>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingChallenge ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
