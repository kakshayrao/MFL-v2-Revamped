'use client';

import * as React from 'react';
import { use } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Badge,
} from '@/components/ui/badge';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Plus, CheckCircle2, Clock3, XCircle, Shield, FileText, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useRole } from '@/contexts/role-context';
import { cn } from '@/lib/utils';
import { SubTeamManager } from '@/components/challenges/sub-team-manager';

// Types ---------------------------------------------------------------------

type Challenge = {
  id: string;
  name: string;
  description: string | null;
  challenge_type: 'individual' | 'team' | 'sub_team';
  total_points: number;
  status: 'active' | 'upcoming' | 'closed';
  start_date: string | null;
  end_date: string | null;
  doc_url: string | null;
  is_custom: boolean;
  template_id: string | null;
  my_submission: ChallengeSubmission | null;
  stats: { pending: number; approved: number; rejected: number } | null;
};

type ChallengeSubmission = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  awarded_points: number | null;
  created_at: string;
};

type SubmissionRow = ChallengeSubmission & {
  league_member_id: string;
  leaguemembers?: {
    role: string | null;
    teams?: { team_name: string | null } | null;
    users?: { username: string | null } | null;
  } | null;
};

// Helpers -------------------------------------------------------------------

function statusBadge(status: Challenge['status']) {
  const map = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700' },
    upcoming: { label: 'Upcoming', className: 'bg-blue-100 text-blue-700' },
    closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700' },
  } as const;
  const cfg = map[status] || map.active;
  return <Badge className={cn('w-fit', cfg.className)} variant="outline">{cfg.label}</Badge>;
}

function submissionStatusBadge(status: ChallengeSubmission['status']) {
  const map = {
    pending: { label: 'Pending', icon: Clock3, className: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700' },
  } as const;
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 w-fit', cfg.className)}>
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}

// Component -----------------------------------------------------------------

export default function LeagueChallengesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: leagueId } = use(params);
  const { isHost, isGovernor } = useRole();
  const isAdmin = isHost || isGovernor;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [challenges, setChallenges] = React.useState<Challenge[]>([]);
  const [presets, setPresets] = React.useState<any[]>([]);
  const [selectedPresetId, setSelectedPresetId] = React.useState<string>('');

  // Create challenge dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    name: '',
    description: '',
    challengeType: 'individual' as Challenge['challenge_type'],
    totalPoints: 0,
    startDate: '',
    endDate: '',
    docUrl: '',
    status: 'active' as Challenge['status'],
  });

  // Activate preset dialog state
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<any | null>(null);
  const [activateForm, setActivateForm] = React.useState({
    totalPoints: 50,
    startDate: '',
    endDate: '',
  });

  // Submit dialog state
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [submitChallenge, setSubmitChallenge] = React.useState<Challenge | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // Review dialog state
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [reviewChallenge, setReviewChallenge] = React.useState<Challenge | null>(null);
  const [submissions, setSubmissions] = React.useState<SubmissionRow[]>([]);
  const [validatingId, setValidatingId] = React.useState<string | null>(null);
  const [reviewAwardedPoints, setReviewAwardedPoints] = React.useState<Record<string, number | ''>>({});
  const [reviewFilterTeamId, setReviewFilterTeamId] = React.useState<string>('');
  const [reviewFilterSubTeamId, setReviewFilterSubTeamId] = React.useState<string>('');
  const [teams, setTeams] = React.useState<Array<{ team_id: string; team_name: string }>>([]);
  const [subTeams, setSubTeams] = React.useState<Array<{ subteam_id: string; name: string }>>([]);
  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [challengeToDelete, setChallengeToDelete] = React.useState<Challenge | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fetchChallenges = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/challenges`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load challenges');
      }
      setChallenges(json.data?.active || []);
      setPresets(json.data?.availablePresets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenges');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  React.useEffect(() => {
    fetchChallenges();
    if (isAdmin) {
      fetchTeams();
    }
  }, [fetchChallenges, isAdmin]);

  const handleActivatePreset = () => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (preset) {
      setSelectedPreset(preset);
      setActivateForm({
        totalPoints: 50,
        startDate: '',
        endDate: '',
      });
      setActivateOpen(true);
    }
  };

  const handleSubmitActivation = async () => {
    if (!selectedPreset) return;

    try {
      const payload = {
        name: selectedPreset.name,
        description: selectedPreset.description || '',
        challengeType: selectedPreset.challenge_type,
        totalPoints: Number(activateForm.totalPoints) || 0,
        startDate: activateForm.startDate || null,
        endDate: activateForm.endDate || null,
        docUrl: selectedPreset.doc_url || null,
        templateId: selectedPreset.id,
        isCustom: false,
        status: 'active',
      };

      const res = await fetch(`/api/leagues/${leagueId}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to activate challenge');
      }

      toast.success('Challenge activated successfully');
      setActivateOpen(false);
      setSelectedPresetId('');
      setSelectedPreset(null);
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate challenge');
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let docUrl = createForm.docUrl || null;

      // Upload document if file selected
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('league_id', leagueId);

        const uploadRes = await fetch('/api/upload/challenge-document', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Document upload failed');
        }

        docUrl = uploadData.data.url;
      }

      const payload = {
        name: createForm.name,
        description: createForm.description,
        challengeType: createForm.challengeType,
        totalPoints: Number(createForm.totalPoints) || 0,
        startDate: createForm.startDate || null,
        endDate: createForm.endDate || null,
        docUrl,
        status: createForm.status,
        isCustom: true,
      };

      const res = await fetch(`/api/leagues/${leagueId}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      
      // Check if payment is required
      if (res.status === 402) {
        toast.error('Payment required for custom challenges. Feature coming soon.');
        return;
      }

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create challenge');
      }

      toast.success('Challenge created');
      setCreateOpen(false);
      setSelectedFile(null);
      setCreateForm({
        name: '',
        description: '',
        challengeType: 'individual',
        totalPoints: 0,
        startDate: '',
        endDate: '',
        docUrl: '',
        status: 'active',
      });
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create challenge');
    }
  };

  const handleOpenSubmit = (challenge: Challenge) => {
    setSubmitChallenge(challenge);
    setSelectedFile(null);
    setSubmitOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUploadAndSubmit = async () => {
    if (!submitChallenge) return;
    if (!selectedFile) {
      toast.error('Please choose a proof image');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('league_id', leagueId);
      formData.append('challenge_id', submitChallenge.id);

      const uploadRes = await fetch('/api/upload/challenge-proof', {
        method: 'POST',
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.success) {
        throw new Error(uploadJson.error || 'Upload failed');
      }

      const proofUrl = uploadJson.data.url as string;

      const submitRes = await fetch(
        `/api/leagues/${leagueId}/challenges/${submitChallenge.id}/submissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proofUrl }),
        }
      );

      const submitJson = await submitRes.json();
      if (!submitRes.ok || !submitJson.success) {
        throw new Error(submitJson.error || 'Submit failed');
      }

      toast.success('Submission sent for review');
      setSubmitOpen(false);
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (challenge: Challenge) => {
    setChallengeToDelete(challenge);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!challengeToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/challenges/${challengeToDelete.id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete challenge');
      }

      toast.success(`Challenge "${challengeToDelete.name}" deleted successfully`);
      setDeleteOpen(false);
      setChallengeToDelete(null);
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete challenge');
    } finally {
      setDeleting(false);
    }
  };

  const fetchSubmissions = async (challenge: Challenge) => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (reviewFilterTeamId) {
        params.append('teamId', reviewFilterTeamId);
      }
      if (reviewFilterSubTeamId) {
        params.append('subTeamId', reviewFilterSubTeamId);
      }

      const url = `/api/leagues/${leagueId}/challenges/${challenge.id}/submissions?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load submissions');
      }
      setSubmissions(json.data || []);
      setReviewChallenge(challenge);
      setReviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load submissions');
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams`);
      const json = await res.json();
      if (res.ok && json.success) {
        setTeams(json.data?.teams || []);
      }
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  };

  const fetchSubTeams = async (challengeId: string, teamId: string) => {
    try {
      console.log('[fetchSubTeams] Fetching for challenge:', challengeId, 'team:', teamId);
      const res = await fetch(
        `/api/leagues/${leagueId}/challenges/${challengeId}/subteams?teamId=${teamId}`
      );
      const json = await res.json();
      console.log('[fetchSubTeams] Response:', json);
      if (res.ok && json.success) {
        setSubTeams(json.data || []);
        console.log('[fetchSubTeams] Set sub-teams:', json.data?.length || 0, 'items');
      } else {
        console.error('[fetchSubTeams] Failed:', json.error);
      }
    } catch (err) {
      console.error('Failed to load sub-teams:', err);
    }
  };

  const handleOpenReview = async (challenge: Challenge) => {
    setReviewFilterTeamId('');
    setReviewFilterSubTeamId('');
    setSubTeams([]);
    
    if (challenge.challenge_type === 'team' || challenge.challenge_type === 'sub_team') {
      await fetchTeams();
    }
    
    // Fetch submissions without team filter initially
    await fetchSubmissions(challenge);
  };

  // Re-fetch submissions when filters change
  React.useEffect(() => {
    if (reviewChallenge && reviewOpen) {
      fetchSubmissions(reviewChallenge);
    }
  }, [reviewFilterTeamId, reviewFilterSubTeamId]);

  // Fetch sub-teams when team filter changes for sub_team challenges
  React.useEffect(() => {
    if (reviewChallenge?.challenge_type === 'sub_team' && reviewFilterTeamId && reviewChallenge.id) {
      setReviewFilterSubTeamId('');
      fetchSubTeams(reviewChallenge.id, reviewFilterTeamId);
    } else {
      setSubTeams([]);
    }
  }, [reviewFilterTeamId, reviewChallenge]);

  // Auto-select first team when teams are loaded
  React.useEffect(() => {
    if (teams.length > 0 && !reviewFilterTeamId && reviewOpen) {
      setReviewFilterTeamId(teams[0].team_id);
    }
  }, [teams, reviewOpen]);

  const handleValidate = async (submissionId: string, status: 'approved' | 'rejected', awardedPoints?: number | null) => {
    setValidatingId(submissionId);
    try {
      const body: any = { status };
      if (awardedPoints !== undefined) body.awardedPoints = awardedPoints;
      const res = await fetch(`/api/challenge-submissions/${submissionId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update');
      }
      toast.success(`Submission ${status}`);
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, status } : s))
      );
      fetchChallenges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setValidatingId(null);
    }
  };

  const emptyState = (
    <div className="text-center py-12 border rounded-lg bg-muted/30">
      <FileText className="mx-auto mb-3 text-muted-foreground" />
      <p className="text-muted-foreground">No challenges yet.</p>
      {isAdmin && (
        <Button className="mt-4" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          Create Challenge
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-4 lg:gap-6">
      <div className="flex flex-col gap-3 px-4 lg:px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">League Challenges</h1>
          <p className="text-muted-foreground">
            Submit proof for active challenges. Hosts/Governors can review submissions.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create Challenge
          </Button>
        )}
      </div>

      <div className="px-4 lg:px-6 space-y-4">
        {loading && <p className="text-muted-foreground">Loading challenges...</p>}
        {error && <p className="text-destructive">{error}</p>}

        {/* Available Presets */}
        {!loading && !error && presets.length > 0 && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Pre-configured Challenges</CardTitle>
              <CardDescription>
                Select a challenge to activate for your league
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="preset-select">Challenge</Label>
                  <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                    <SelectTrigger id="preset-select">
                      <SelectValue placeholder="Choose a challenge..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name} ({preset.challenge_type?.replace('_', ' ')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleActivatePreset}
                  disabled={!selectedPresetId}
                >
                  Activate Challenge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && challenges.length === 0 && presets.length === 0 && emptyState}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {challenges.map((challenge) => (
            <Card key={challenge.id} className="flex flex-col">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-1">{challenge.name}</CardTitle>
                  {statusBadge(challenge.status)}
                </div>
                <CardDescription className="line-clamp-2">
                  {challenge.description || 'No description provided'}
                </CardDescription>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{challenge.challenge_type}</Badge>
                  <span className="font-medium text-foreground">{challenge.total_points} pts</span>
                </div>
                <div className="text-xs text-muted-foreground flex gap-2">
                  {challenge.start_date && <span>Start: {challenge.start_date}</span>}
                  {challenge.end_date && <span>End: {challenge.end_date}</span>}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                {challenge.doc_url && (
                  <a
                    href={challenge.doc_url}
                    className="text-sm text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Brief / Rules
                  </a>
                )}

                {challenge.stats && isAdmin && (
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Pending: {challenge.stats.pending}</span>
                    <span>Approved: {challenge.stats.approved}</span>
                    <span>Rejected: {challenge.stats.rejected}</span>
                  </div>
                )}

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleOpenSubmit(challenge)}>
                      <Upload className="mr-2 size-4" />
                      Submit Proof
                    </Button>
                    {challenge.my_submission && submissionStatusBadge(challenge.my_submission.status)}
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReview(challenge)}
                          className="ml-auto"
                        >
                          <Shield className="mr-2 size-4" />
                          Review
                        </Button>
                        {isHost && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(challenge)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  {isAdmin && challenge.challenge_type === 'sub_team' && (
                    <SubTeamManager
                      leagueId={leagueId}
                      challengeId={challenge.id}
                      teams={teams}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Challenge Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Challenge</DialogTitle>
            <DialogDescription>
              Set up a new league-scoped challenge. Custom challenges require payment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateChallenge} className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-900">
                <strong>Note:</strong> Creating a custom challenge requires a one-time payment. You will be prompted to complete payment after filling in the details.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={createForm.challengeType}
                  onValueChange={(val) =>
                    setCreateForm((p) => ({ ...p, challengeType: val as Challenge['challenge_type'] }))
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
                <Label>Total Points</Label>
                <Input
                  type="number"
                  value={createForm.totalPoints}
                  min={0}
                  onChange={(e) => setCreateForm((p) => ({ ...p, totalPoints: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
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
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={createForm.status}
                onValueChange={(val) => setCreateForm((p) => ({ ...p, status: val as Challenge['status'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activate Pre-configured Challenge Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Activate Challenge</DialogTitle>
            <DialogDescription>
              Configure points and dates for this challenge
            </DialogDescription>
          </DialogHeader>
          {selectedPreset && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="font-semibold">{selectedPreset.name}</h3>
                {selectedPreset.description && (
                  <p className="text-sm text-muted-foreground">{selectedPreset.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {selectedPreset.challenge_type?.replace('_', ' ')}
                  </Badge>
                  {selectedPreset.doc_url && (
                    <a
                      href={selectedPreset.doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <FileText className="size-3" />
                      View Rules
                    </a>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activate-points">Total Points</Label>
                <Input
                  id="activate-points"
                  type="number"
                  min={0}
                  value={activateForm.totalPoints}
                  onChange={(e) =>
                    setActivateForm((p) => ({ ...p, totalPoints: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="activate-start">Start Date</Label>
                  <Input
                    id="activate-start"
                    type="date"
                    value={activateForm.startDate}
                    onChange={(e) => setActivateForm((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activate-end">End Date</Label>
                  <Input
                    id="activate-end"
                    type="date"
                    value={activateForm.endDate}
                    onChange={(e) => setActivateForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitActivation}>
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Proof Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Proof</DialogTitle>
            <DialogDescription>
              Upload an image as proof for {submitChallenge?.name || 'this challenge'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Proof Image</Label>
              <Input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                Allowed: JPG, PNG, GIF, WebP. Max 10MB.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadAndSubmit} disabled={uploading}>
              {uploading ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Submissions</DialogTitle>
            <DialogDescription>
              {reviewChallenge?.name || 'Challenge'} ({reviewChallenge?.challenge_type})
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          {reviewChallenge && (reviewChallenge.challenge_type === 'team' || reviewChallenge.challenge_type === 'sub_team') && (
            <div className="space-y-3 pb-3 border-b">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Team Selector */}
                {teams.length > 0 && (
                  <div>
                    <Label htmlFor="filter-team">Filter by Team (optional)</Label>
                    <Select value={reviewFilterTeamId} onValueChange={setReviewFilterTeamId}>
                      <SelectTrigger id="filter-team">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.team_id} value={team.team_id}>
                            {team.team_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Sub-Team Selector (only for sub_team challenges) */}
                {reviewChallenge.challenge_type === 'sub_team' && reviewFilterTeamId && (
                  <div>
                    <Label htmlFor="filter-subteam">Filter by Sub-Team (optional)</Label>
                    <Select value={reviewFilterSubTeamId} onValueChange={setReviewFilterSubTeamId}>
                      <SelectTrigger id="filter-subteam">
                        <SelectValue placeholder={subTeams.length === 0 ? 'No sub-teams created' : 'Select sub-team...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {subTeams.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No sub-teams for this team
                          </div>
                        ) : (
                          subTeams.map((subTeam) => (
                            <SelectItem key={subTeam.subteam_id} value={subTeam.subteam_id}>
                              {subTeam.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {submissions.length === 0 && (
              <p className="text-muted-foreground text-sm">No submissions yet.</p>
            )}
            {submissions.length > 0 && (
              <div className="space-y-3">
                {submissions.map((s) => {
                  const username = s.leaguemembers?.users?.username || 'Member';
                  const teamName = s.leaguemembers?.teams?.team_name;
                  return (
                    <div key={s.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 justify-between">
                        <div>
                          <p className="font-medium">{username}</p>
                          <p className="text-xs text-muted-foreground">
                            {teamName || 'Unassigned'}
                          </p>
                        </div>
                        {submissionStatusBadge(s.status)}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Submitted: {format(parseISO(s.created_at), 'MMM d, yyyy h:mma')}</p>
                        {s.reviewed_at && (
                          <p>Reviewed: {format(parseISO(s.reviewed_at), 'MMM d, yyyy h:mma')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={s.proof_url}
                          className="text-primary text-sm underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View Proof
                        </a>
                        {isAdmin && s.status === 'pending' && (
                          <div className="flex gap-2 ml-auto items-center">
                            <Input
                              type="number"
                              min={0}
                              placeholder="Points"
                              value={reviewAwardedPoints[s.id] ?? ''}
                              onChange={(e) =>
                                setReviewAwardedPoints((p) => ({ ...p, [s.id]: e.target.value === '' ? '' : Number(e.target.value) }))
                              }
                              className="w-28"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={validatingId === s.id}
                              onClick={() => handleValidate(s.id, 'rejected', null)}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={validatingId === s.id}
                              onClick={() => handleValidate(s.id, 'approved', reviewAwardedPoints[s.id] === '' ? undefined : (reviewAwardedPoints[s.id] as number))}
                            >
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Challenge Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Challenge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{challengeToDelete?.name}"</strong>? This action cannot be undone. All submissions will be preserved but the challenge will no longer be available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete Challenge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
