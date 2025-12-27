/**
 * GET /api/leagues/[id]/my-submissions - Get current user's submissions for a league
 *
 * Returns all effort entries submitted by the authenticated user for the specified league,
 * including status, proof, and metadata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface MySubmission {
  id: string;
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

    // Get the user's league_member_id for this league
    const { data: leagueMember, error: memberError } = await supabase
      .from('leaguemembers')
      .select('league_member_id, team_id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (memberError) {
      console.error('Error fetching league member:', memberError);
      return NextResponse.json(
        { error: 'Failed to verify membership' },
        { status: 500 }
      );
    }

    if (!leagueMember) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    // Get optional query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query for user's submissions
    let query = supabase
      .from('effortentry')
      .select(`
        id,
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
      .eq('league_member_id', leagueMember.league_member_id)
      .order('date', { ascending: false });

    // Apply optional filters
    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: submissions, error: submissionsError } = await query;

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json(
        { error: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const stats = {
      total: submissions?.length || 0,
      pending: submissions?.filter((s) => s.status === 'pending').length || 0,
      approved: submissions?.filter((s) => s.status === 'approved').length || 0,
      rejected: submissions?.filter((s) => s.status === 'rejected').length || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        submissions: submissions as MySubmission[],
        stats,
        leagueMemberId: leagueMember.league_member_id,
        teamId: leagueMember.team_id,
      },
    });
  } catch (error) {
    console.error('Error in my-submissions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
