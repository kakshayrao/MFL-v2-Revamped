/**
 * PUT /api/leagues/[id]/challenges/[challengeId]/subteams/[subteamId] - Update sub-team
 * DELETE /api/leagues/[id]/challenges/[challengeId]/subteams/[subteamId] - Delete sub-team
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

type LeagueRole = 'host' | 'governor' | 'captain' | 'player' | null;

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function getMembership(userId: string, leagueId: string) {
  const supabase = getSupabaseServiceRole();
  
  const { data: memberData, error: memberError } = await supabase
    .from('leaguemembers')
    .select('league_member_id')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();

  if (memberError || !memberData) {
    return null;
  }

  const { data: roleData, error: roleError } = await supabase
    .from('assignedrolesforleague')
    .select('roles(role_name)')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

  if (roleError) {
    return null;
  }

  const roleNames = (roleData || []).map((r: any) => r.roles?.role_name).filter(Boolean);
  const primaryRole = (roleNames[0] as LeagueRole) ?? null;

  return {
    leagueMemberId: String(memberData.league_member_id),
    role: primaryRole,
  };
}

function isHostOrGovernor(role: LeagueRole): boolean {
  return role === 'host' || role === 'governor';
}

// PUT - Update sub-team
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string; subteamId: string }> }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const { id: leagueId, subteamId } = await params;
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership || !isHostOrGovernor(membership.role)) {
      return buildError('Only hosts/governors can update sub-teams', 403);
    }

    const body = await req.json();
    const { name, memberIds } = body;

    // Update sub-team name if provided
    if (name) {
      const { error: updateError } = await supabase
        .from('challenge_subteams')
        .update({ name })
        .eq('subteam_id', subteamId);

      if (updateError) {
        console.error('Error updating sub-team:', updateError);
        return buildError('Failed to update sub-team', 500);
      }
    }

    // Update members if provided
    if (memberIds && Array.isArray(memberIds)) {
      // Delete existing members
      await supabase
        .from('challenge_subteam_members')
        .delete()
        .eq('subteam_id', subteamId);

      // Add new members
      if (memberIds.length > 0) {
        const memberRecords = memberIds.map((memberId: string) => ({
          subteam_id: subteamId,
          league_member_id: memberId,
        }));

        const { error: membersError } = await supabase
          .from('challenge_subteam_members')
          .insert(memberRecords);

        if (membersError) {
          console.error('Error updating sub-team members:', membersError);
          return buildError('Failed to update sub-team members', 500);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in PUT sub-team:', err);
    return buildError('Internal server error', 500);
  }
}

// DELETE - Delete sub-team
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string; subteamId: string }> }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const { id: leagueId, subteamId } = await params;
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership || !isHostOrGovernor(membership.role)) {
      return buildError('Only hosts/governors can delete sub-teams', 403);
    }

    const { error } = await supabase
      .from('challenge_subteams')
      .delete()
      .eq('subteam_id', subteamId);

    if (error) {
      console.error('Error deleting sub-team:', error);
      return buildError('Failed to delete sub-team', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in DELETE sub-team:', err);
    return buildError('Internal server error', 500);
  }
}
