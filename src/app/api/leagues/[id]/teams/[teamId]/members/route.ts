/**
 * GET /api/leagues/[id]/teams/[teamId]/members - Get team members
 * POST /api/leagues/[id]/teams/[teamId]/members - Add member to team
 * DELETE /api/leagues/[id]/teams/[teamId]/members - Remove member from team
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { z } from 'zod';
import {
  getTeamMembers,
  assignMemberToTeam,
  removeMemberFromTeam,
} from '@/lib/services/teams';
import { getLeagueById } from '@/lib/services/leagues';
import { userHasAnyRole } from '@/lib/services/roles';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// Helper to check if user is league member
async function isLeagueMember(userId: string, leagueId: string): Promise<boolean> {
  const supabase = getSupabaseServiceRole();
  const { data } = await supabase
    .from('leaguemembers')
    .select('league_member_id')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();
  return !!data;
}

const addMemberSchema = z.object({
  league_member_id: z.string().uuid('Invalid member ID'),
});

const removeMemberSchema = z.object({
  league_member_id: z.string().uuid('Invalid member ID'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: leagueId, teamId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of this league (via leaguemembers or roles)
    const isMember = await isLeagueMember(session.user.id, leagueId);
    const hasRole = await userHasAnyRole(session.user.id, leagueId, [
      'host',
      'governor',
      'captain',
      'player',
    ]);

    if (!isMember && !hasRole) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    console.log('[Team Members API] Fetching members for team:', teamId, 'league:', leagueId);
    const members = await getTeamMembers(teamId, leagueId);
    console.log('[Team Members API] Fetched members:', members);

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: leagueId, teamId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions (must be host or governor)
    const canAssign = await userHasAnyRole(session.user.id, leagueId, [
      'host',
      'governor',
    ]);

    if (!canAssign) {
      return NextResponse.json(
        { error: 'Only host or governor can assign members to teams' },
        { status: 403 }
      );
    }

    // Get league to check team_size limit
    const league = await getLeagueById(leagueId);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Get current team size
    const currentMembers = await getTeamMembers(teamId, leagueId);
    if (currentMembers.length >= league.team_size) {
      return NextResponse.json(
        { error: `Team is full. Maximum ${league.team_size} members allowed.` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = addMemberSchema.parse(body);

    // Verify the member exists and belongs to this league
    const supabase = getSupabaseServiceRole();
    const { data: member } = await supabase
      .from('leaguemembers')
      .select('league_member_id, team_id, league_id')
      .eq('league_member_id', validated.league_member_id)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found in this league' },
        { status: 404 }
      );
    }

    if (member.team_id) {
      return NextResponse.json(
        { error: 'Member is already assigned to a team' },
        { status: 400 }
      );
    }

    const success = await assignMemberToTeam(
      validated.league_member_id,
      teamId,
      session.user.id
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to assign member to team' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member assigned to team successfully',
    });
  } catch (error) {
    console.error('Error assigning member to team:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to assign member to team' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const { id: leagueId, teamId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions (must be host or governor)
    const canRemove = await userHasAnyRole(session.user.id, leagueId, [
      'host',
      'governor',
    ]);

    if (!canRemove) {
      return NextResponse.json(
        { error: 'Only host or governor can remove members from teams' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = removeMemberSchema.parse(body);

    const success = await removeMemberFromTeam(
      validated.league_member_id,
      session.user.id
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove member from team' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed from team successfully',
    });
  } catch (error) {
    console.error('Error removing member from team:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to remove member from team' },
      { status: 500 }
    );
  }
}
