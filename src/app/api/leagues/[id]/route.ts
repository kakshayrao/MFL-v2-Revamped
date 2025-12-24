/**
 * GET /api/leagues/[id] - Get league details
 * PATCH /api/leagues/[id] - Update league (Host only, draft status only)
 * DELETE /api/leagues/[id] - Delete league (Host only, draft status only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import {
  getLeagueById,
  updateLeague,
  deleteLeague,
  getUserRoleInLeague,
} from '@/lib/services/leagues';
import { z } from 'zod';

const updateLeagueSchema = z.object({
  league_name: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_exclusive: z.boolean().optional(),
  is_public: z.boolean().optional(),
  num_teams: z.number().int().positive().optional(),
  team_size: z.number().int().positive().optional(),
  rest_days: z.number().int().min(0).optional(),
  auto_rest_day_enabled: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const league = await getLeagueById(id);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    return NextResponse.json({ data: league, success: true });
  } catch (error) {
    console.error('Error fetching league:', error);
    return NextResponse.json(
      { error: 'Failed to fetch league' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateLeagueSchema.parse(body);

    const updated = await updateLeague(id, session.user.id, validated);
    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update league (host only; limited fields once launched)' },
        { status: 403 }
      );
    }

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    console.error('Error updating league:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update league' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await deleteLeague(id, session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete league (must be host and league must be in draft status)' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting league:', error);
    return NextResponse.json(
      { error: 'Failed to delete league' },
      { status: 500 }
    );
  }
}

