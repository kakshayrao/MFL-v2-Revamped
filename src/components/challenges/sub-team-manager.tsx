'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Plus, Trash2, Edit } from 'lucide-react';

interface SubTeam {
  subteam_id: string;
  name: string;
  team_id: string;
  members: {
    league_member_id: string;
    user_id: string;
    full_name: string;
  }[];
}

interface TeamMember {
  league_member_id: string;
  user_id: string;
  full_name: string;
}

interface SubTeamManagerProps {
  leagueId: string;
  challengeId: string;
  teams: Array<{ team_id: string; team_name: string }>;
}

export function SubTeamManager({ leagueId, challengeId, teams }: SubTeamManagerProps) {
  const [open, setOpen] = useState(false);
  const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Team selection
  // "pendingTeamId" is the value in the dropdown; "selectedTeamId" is the applied filter
  const [pendingTeamId, setPendingTeamId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  // Form state
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subTeamName, setSubTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const selectedTeam = teams.find(t => t.team_id === selectedTeamId);

  // Initialize pending team when dialog opens or teams change
  useEffect(() => {
    if (open && teams.length > 0 && !pendingTeamId) {
      setPendingTeamId(teams[0].team_id);
    }
  }, [open, teams, pendingTeamId]);

  // Clear data when applied team changes
  useEffect(() => {
    if (selectedTeamId) {
      setSubTeams([]);
      setTeamMembers([]);
    }
  }, [selectedTeamId]);

  // Fetch data when dialog opens or applied team changes
  useEffect(() => {
    if (open && selectedTeamId) {
      fetchSubTeams();
      fetchTeamMembers();
    }
  }, [open, selectedTeamId]);

  // Also fetch team members when create dialog opens (in case team was already selected)
  useEffect(() => {
    if (createOpen && selectedTeamId) {
      console.log('create dialog opened, fetching members for team:', selectedTeamId);
      fetchTeamMembers();
    }
  }, [createOpen]);

  async function fetchSubTeams() {
    if (!selectedTeamId) return;
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/challenges/${challengeId}/subteams?teamId=${selectedTeamId}`
      );
      if (response.ok) {
        const json = await response.json();
        // Transform the data to match our SubTeam interface
        const transformed = (json.data || []).map((st: any) => ({
          subteam_id: st.subteam_id,
          name: st.name,
          team_id: st.team_id,
          members: (st.challenge_subteam_members || []).map((csm: any) => ({
            league_member_id: csm.league_member_id,
            user_id: csm.leaguemembers?.user_id,
            full_name: csm.leaguemembers?.users?.username || 'Unknown',
          })),
        }));
        setSubTeams(transformed);
      }
    } catch (error) {
      console.error('Error fetching sub-teams:', error);
    }
  }

  async function fetchTeamMembers() {
    if (!selectedTeamId) {
      console.log('skippping fetchTeamMembers - no selectedTeamId');
      return;
    }
    
    try {
      console.log('Fetching members for team:', selectedTeamId);
      const url = `/api/leagues/${leagueId}/teams/${selectedTeamId}/members`;
      console.log('Fetch URL:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched team members:', data);
        // The API returns { success: true, data: members[] }
        const members = data.data || data.members || [];
        const transformed = members.map((m: any) => ({
          league_member_id: m.league_member_id,
          user_id: m.user_id,
          full_name: m.username || 'Unknown', // Use username since that's what's available
        }));
        setTeamMembers(transformed);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch team members:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }

  async function handleCreateOrUpdate() {
    if (!subTeamName.trim()) {
      toast.error('Sub-team name is required');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Update existing sub-team
        const response = await fetch(
          `/api/leagues/${leagueId}/challenges/${challengeId}/subteams/${editingId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: subTeamName,
              memberIds: selectedMembers,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update sub-team');
        }

        toast.success('Sub-team updated successfully');
      } else {
        // Create new sub-team
        const response = await fetch(
          `/api/leagues/${leagueId}/challenges/${challengeId}/subteams`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teamId: selectedTeamId,
              name: subTeamName,
              memberIds: selectedMembers,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to create sub-team');
        }

        toast.success('Sub-team created successfully');
      }

      setSubTeamName('');
      setSelectedMembers([]);
      setEditingId(null);
      setCreateOpen(false);
      fetchSubTeams();
    } catch (error) {
      console.error('Error saving sub-team:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save sub-team');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(subteamId: string) {
    if (!confirm('Are you sure you want to delete this sub-team?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/challenges/${challengeId}/subteams/${subteamId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete sub-team');
      }

      toast.success('Sub-team deleted successfully');
      fetchSubTeams();
    } catch (error) {
      console.error('Error deleting sub-team:', error);
      toast.error('Failed to delete sub-team');
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(subTeam: SubTeam) {
    setEditingId(subTeam.subteam_id);
    setSubTeamName(subTeam.name);
    setSelectedMembers(subTeam.members.map(m => m.league_member_id));
    setCreateOpen(true);
  }

  function handleToggleMember(memberId: string) {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Users className="mr-2 h-4 w-4" />
          Manage Sub-Teams
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sub-Team Management</DialogTitle>
          <DialogDescription>
            Create and manage sub-teams for this challenge. Sub-team members can submit proofs
            individually, and points will contribute to both the sub-team and main team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team Selector */}
          <div>
            <Label htmlFor="team-select">Select Team</Label>
            <div className="flex gap-2 items-end">
              <Select value={pendingTeamId} onValueChange={setPendingTeamId}>
              <SelectTrigger id="team-select">
                <SelectValue placeholder="Choose a team..." />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.team_id} value={team.team_id}>
                    {team.team_name}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  // Apply filter explicitly
                  setSelectedTeamId(pendingTeamId);
                }}
                disabled={!pendingTeamId}
              >
                Apply
              </Button>
            </div>
          </div>

          {selectedTeamId && (
            <>
              {/* Create/Edit Dialog */}
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingId(null);
                      setSubTeamName('');
                      setSelectedMembers([]);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Sub-Team
                  </Button>
                </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit' : 'Create'} Sub-Team</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subteam-name">Sub-Team Name</Label>
                  <Input
                    id="subteam-name"
                    value={subTeamName}
                    onChange={(e) => setSubTeamName(e.target.value)}
                    placeholder="e.g., Team A1, Team B2"
                  />
                </div>
                <div>
                  <Label>Select Members</Label>
                  {teamMembers.length === 0 ? (
                    <div className="border rounded-md p-3">
                      <p className="text-sm text-muted-foreground">Loading team members...</p>
                    </div>
                  ) : (
                    <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-y-auto">
                      {teamMembers.map((member) => (
                        <div key={member.league_member_id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`member-${member.league_member_id}`}
                            checked={selectedMembers.includes(member.league_member_id)}
                            onCheckedChange={() => handleToggleMember(member.league_member_id)}
                          />
                          <label
                            htmlFor={`member-${member.league_member_id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {member.full_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateOrUpdate} disabled={loading}>
                    {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
              </Dialog>

              {/* Sub-Teams List */}
              <div className="space-y-3">
                <h3 className="font-semibold">Existing Sub-Teams for {selectedTeam?.team_name}</h3>
                {subTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sub-teams created yet. Click &quot;Create Sub-Team&quot; to get started.
                  </p>
                ) : (
                  subTeams.map((subTeam) => (
                    <div
                      key={subTeam.subteam_id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{subTeam.name}</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(subTeam)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(subTeam.subteam_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Members:</span>{' '}
                        {subTeam.members.length > 0
                          ? subTeam.members.map(m => m.full_name).join(', ')
                          : 'No members assigned'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
