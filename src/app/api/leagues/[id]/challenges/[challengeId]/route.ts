import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

/**
 * DELETE /api/leagues/[id]/challenges/[challengeId]
 * Delete a league challenge (Host only)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const { id: leagueId, challengeId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // Check if user is host of the league
    const { data: roleData, error: roleError } = await supabase
      .from('assignedrolesforleague')
      .select('roles(role_name)')
      .eq('user_id', session.user.id)
      .eq('league_id', leagueId);

    if (roleError) {
      console.error('Error checking user role:', roleError);
      return NextResponse.json(
        { success: false, error: 'Failed to verify permissions' },
        { status: 500 }
      );
    }

    const roles = (roleData || []).map((r: any) => r.roles?.role_name);
    const isHost = roles.includes('host');

    if (!isHost) {
      return NextResponse.json(
        { success: false, error: 'Only hosts can delete challenges' },
        { status: 403 }
      );
    }

    // Verify challenge belongs to this league
    const { data: challenge, error: checkError } = await supabase
      .from('leagueschallenges')
      .select('id, league_id')
      .eq('id', challengeId)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (checkError || !challenge) {
      return NextResponse.json(
        { success: false, error: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Delete the challenge
    const { error: deleteError } = await supabase
      .from('leagueschallenges')
      .delete()
      .eq('id', challengeId);

    if (deleteError) {
      console.error('Error deleting challenge:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete challenge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Challenge deleted successfully',
    });
  } catch (err) {
    console.error('Error in DELETE challenge:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
