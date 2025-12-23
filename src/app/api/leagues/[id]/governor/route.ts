/**
 * GET /api/leagues/[id]/governor - Get current governors
 * POST /api/leagues/[id]/governor - Assign governor (Host only)
 * DELETE /api/leagues/[id]/governor - Remove governor (Host only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { z } from 'zod';
import { assignGovernor, removeGovernor, getLeagueGovernors } from '@/lib/services/teams';
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

const assignGovernorSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
});

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

    const governors = await getLeagueGovernors(leagueId);

    return NextResponse.json({
      success: true,
      data: governors,
    });
  } catch (error) {
    console.error('Error fetching governor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch governor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions (must be host only)
    const isHost = await userHasAnyRole(session.user.id, leagueId, ['host']);

    if (!isHost) {
      return NextResponse.json(
        { error: 'Only the host can assign a governor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = assignGovernorSchema.parse(body);

    const result = await assignGovernor(
      validated.user_id,
      leagueId,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to assign governor' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Governor assigned successfully',
    });
  } catch (error) {
    console.error('Error assigning governor:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to assign governor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions (must be host only)
    const isHost = await userHasAnyRole(session.user.id, leagueId, ['host']);

    if (!isHost) {
      return NextResponse.json(
        { error: 'Only the host can remove a governor' },
        { status: 403 }
      );
    }

    // Get user_id from request body
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    const success = await removeGovernor(user_id, leagueId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove governor' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Governor removed successfully',
    });
  } catch (error) {
    console.error('Error removing governor:', error);
    return NextResponse.json(
      { error: 'Failed to remove governor' },
      { status: 500 }
    );
  }
}
