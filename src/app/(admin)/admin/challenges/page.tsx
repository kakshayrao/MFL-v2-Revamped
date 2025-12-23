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
