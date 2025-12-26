/**
 * GET /api/leagues/[id]/submissions - Get all submissions for a league (Host/Governor only)
 *
 * Returns all effort entries for the specified league with member and team info.
 * Used by Host and Governor for the "All Submissions" oversight view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { userHasAnyRole } from '@/lib/services/roles';

// ============================================================================
// Types
// ============================================================================

export interface LeagueSubmission {
  id: string;
  league_member_id: string;
  date: string;
  type: 'workout' | 'rest';
  workout_type: string | null;
  duration: number | null;
  distance: number | null;
  steps: number | null;
  holes: number | null;
  rr_value: number | null;
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string | null;
  notes: string | null;
  created_date: string;
  modified_date: string;
  reupload_of: string | null;
  rejection_reason: string | null;
  member: {
    user_id: string;
    username: string;
    email: string;
    team_id: string | null;
    team_name: string | null;
  };
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user is host or governor (only they can access all submissions)
    const canAccess = await userHasAnyRole(userId, leagueId, ['host', 'governor']);

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Only host or governor can view all submissions' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // Get optional query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
    const teamId = searchParams.get('teamId');

    // Get all league members with team info
    const { data: members, error: membersError } = await supabase
      .from('leaguemembers')
      .select(`
        league_member_id,
        user_id,
        team_id,
        users!leaguemembers_user_id_fkey(username, email),
        teams(team_name)
      `)
      .eq('league_id', leagueId);

    if (membersError) {
      console.error('Error fetching league members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch league members' },
        { status: 500 }
      );
    }

    if (!members || members.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          submissions: [],
          stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
          teams: [],
        },
      });
    }

    // Create a map of league_member_id to member info
    const memberMap = new Map<string, {
      user_id: string;
      username: string;
      email: string;
      team_id: string | null;
      team_name: string | null;
    }>();

    const teamSet = new Set<string>();

    members.forEach((m) => {
      const user = m.users as any;
      const team = m.teams as any;
      memberMap.set(m.league_member_id, {
        user_id: m.user_id,
        username: user?.username || 'Unknown',
        email: user?.email || '',
        team_id: m.team_id,
        team_name: team?.team_name || null,
      });
      if (m.team_id && team?.team_name) {
        teamSet.add(JSON.stringify({ team_id: m.team_id, team_name: team.team_name }));
      }
    });

    const memberIds = members.map((m) => m.league_member_id);

    // Build query for all submissions
    let query = supabase
      .from('effortentry')
      .select(`
        id,
        league_member_id,
        date,
        type,
        workout_type,
        duration,
        distance,
        steps,
        holes,
        rr_value,
        status,
        proof_url,
        notes,
        created_date,
        modified_date,
        reupload_of,
        rejection_reason
      `)
      .in('league_member_id', memberIds)
      .order('date', { ascending: false });

    // Apply optional status filter
    if (status) {
      query = query.eq('status', status);
    }

    const { data: submissions, error: submissionsError } = await query;

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json(
        { error: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    // Enrich submissions with member info and filter by team if needed
    let enrichedSubmissions: LeagueSubmission[] = (submissions || []).map((s) => ({
      ...s,
      member: memberMap.get(s.league_member_id) || {
        user_id: '',
        username: 'Unknown',
        email: '',
        team_id: null,
        team_name: null,
      },
    }));

    // Filter by team if specified
    if (teamId) {
      enrichedSubmissions = enrichedSubmissions.filter(
        (s) => s.member.team_id === teamId
      );
    }

    // Calculate summary stats (from filtered results)
    const stats = {
      total: enrichedSubmissions.length,
      pending: enrichedSubmissions.filter((s) => s.status === 'pending').length,
      approved: enrichedSubmissions.filter((s) => s.status === 'approved').length,
      rejected: enrichedSubmissions.filter((s) => s.status === 'rejected').length,
    };

    // Get unique teams for filter dropdown
    const teams = Array.from(teamSet).map((t) => JSON.parse(t));

    return NextResponse.json({
      success: true,
      data: {
        submissions: enrichedSubmissions,
        stats,
        teams,
      },
    });
  } catch (error) {
    console.error('Error in submissions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
