/**
 * GET /api/leagues/[id]/my-team/submissions - Get submissions from captain's team for validation
 *
 * Returns all submissions from the captain's team members that need validation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface TeamSubmission {
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
  modified_by: string | null;
  reupload_of: string | null;
  graded_by_role: 'host' | 'governor' | 'captain' | 'player' | 'system' | null;
  member: {
    user_id: string;
    username: string;
    email: string;
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

    const supabase = getSupabaseServiceRole();
    const userId = session.user.id;

    // Get the user's league membership and verify they are a captain
    const { data: membership, error: membershipError } = await supabase
      .from('leaguemembers')
      .select('league_member_id, team_id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    if (!membership.team_id) {
      return NextResponse.json(
        { error: 'You are not assigned to a team' },
        { status: 403 }
      );
    }

    // Check if user is captain of their team (via assignedrolesforleague)
    const { data: captainRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'captain')
      .single();

    let isCaptain = false;
    if (captainRole) {
      const { data: captainCheck } = await supabase
        .from('assignedrolesforleague')
        .select('id')
        .eq('user_id', userId)
        .eq('league_id', leagueId)
        .eq('role_id', captainRole.role_id)
        .maybeSingle();

      isCaptain = !!captainCheck;
    }

    // Also check if user is host or governor (they can also validate)
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('created_by')
      .eq('league_id', leagueId)
      .single();

    const { data: governorRole } = await supabase
      .from('assignedrolesforleague')
      .select('role_id, roles!inner(role_name)')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .maybeSingle();

    const isHost = leagueData?.created_by === userId;
    const isGovernor = (governorRole?.roles as any)?.role_name === 'governor';

    if (!isCaptain && !isHost && !isGovernor) {
      return NextResponse.json(
        { error: 'Only team captain can validate team submissions' },
        { status: 403 }
      );
    }

    // Get optional query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;

    // Get all team members
    const { data: teamMembers, error: membersError } = await supabase
      .from('leaguemembers')
      .select('league_member_id, user_id, users!leaguemembers_user_id_fkey(username, email)')
      .eq('team_id', membership.team_id)
      .eq('league_id', leagueId);

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      );
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          submissions: [],
          stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
        },
      });
    }

    // Create a map of league_member_id to user info
    const memberMap = new Map<string, { user_id: string; username: string; email: string }>();
    teamMembers.forEach((m) => {
      const user = m.users as any;
      memberMap.set(m.league_member_id, {
        user_id: m.user_id,
        username: user?.username || 'Unknown',
        email: user?.email || '',
      });
    });

    const memberIds = teamMembers.map((m) => m.league_member_id);

    // Build query for team submissions
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
        modified_by,
        reupload_of
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

    const leagueCreatedBy = leagueData?.created_by || null;
    const modifiedByUserIds = Array.from(
      new Set(
        (submissions || [])
          .map((s: any) => s?.modified_by as string | null)
          .filter((v: string | null): v is string => !!v)
      )
    );

    const rolesByUser = new Map<string, Set<string>>();
    if (modifiedByUserIds.length > 0) {
      const { data: roleRows, error: roleRowsError } = await supabase
        .from('assignedrolesforleague')
        .select('user_id, roles!inner(role_name)')
        .eq('league_id', leagueId)
        .in('user_id', modifiedByUserIds);

      if (roleRowsError) {
        console.error('Error fetching grader roles:', roleRowsError);
      } else {
        for (const row of (roleRows || []) as any[]) {
          const uid = row.user_id as string;
          const rn = row.roles?.role_name as string | undefined;
          if (!uid || !rn) continue;
          if (!rolesByUser.has(uid)) rolesByUser.set(uid, new Set());
          rolesByUser.get(uid)!.add(rn);
        }
      }
    }

    const getGradedByRole = (modifiedBy: string | null, status: string): TeamSubmission['graded_by_role'] => {
      if (!modifiedBy) return null;
      if (status === 'pending') return null;
      if (leagueCreatedBy && modifiedBy === leagueCreatedBy) return 'host';
      const roles = rolesByUser.get(modifiedBy);
      if (!roles) return 'player';
      if (roles.has('governor')) return 'governor';
      if (roles.has('captain')) return 'captain';
      if (roles.has('host')) return 'host';
      if (roles.has('player')) return 'player';
      return 'player';
    };

    // Enrich submissions with member info + grader info
    const enrichedSubmissions: TeamSubmission[] = (submissions || []).map((s: any) => ({
      ...s,
      modified_by: (s?.modified_by ?? null) as string | null,
      graded_by_role: getGradedByRole((s?.modified_by ?? null) as string | null, s.status),
      member: memberMap.get(s.league_member_id) || {
        user_id: '',
        username: 'Unknown',
        email: '',
      },
    }));

    // Include all team submissions (including captain's own) for visibility.
    // Validation rules are still enforced by /api/submissions/[id]/validate.
    const visibleSubmissions = enrichedSubmissions;

    // Calculate summary stats
    const stats = {
      total: visibleSubmissions.length,
      pending: visibleSubmissions.filter((s) => s.status === 'pending').length,
      approved: visibleSubmissions.filter((s) => s.status === 'approved').length,
      rejected: visibleSubmissions.filter((s) => s.status === 'rejected').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        submissions: visibleSubmissions,
        stats,
        teamId: membership.team_id,
      },
    });
  } catch (error) {
    console.error('Error in my-team/submissions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
