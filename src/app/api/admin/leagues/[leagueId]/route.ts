import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import {
  getLeagueById,
  updateLeague,
  softDeleteLeague,
} from '@/lib/services/admin';
import type { AdminLeagueUpdateInput } from '@/types/admin';

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

/**
 * GET /api/admin/leagues/[leagueId]
 * Get a single league by ID
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leagueId } = await params;
    const league = await getLeagueById(leagueId);

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    return NextResponse.json({ data: league });
  } catch (error) {
    console.error('Error in admin league GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/leagues/[leagueId]
 * Update a league
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leagueId } = await params;
    const body = await req.json();

    const input: AdminLeagueUpdateInput = {};

    if (body.league_name !== undefined) input.league_name = body.league_name;
    if (body.description !== undefined) input.description = body.description;
    if (body.start_date !== undefined) input.start_date = body.start_date;
    if (body.end_date !== undefined) input.end_date = body.end_date;
    if (body.status !== undefined) input.status = body.status;
    if (body.is_active !== undefined) input.is_active = body.is_active;
    if (body.num_teams !== undefined) input.num_teams = body.num_teams;
    if (body.team_size !== undefined) input.team_size = body.team_size;
    if (body.rest_days !== undefined) input.rest_days = body.rest_days;
    if (body.auto_rest_day_enabled !== undefined) input.auto_rest_day_enabled = body.auto_rest_day_enabled;
    if (body.is_public !== undefined) input.is_public = body.is_public;
    if (body.is_exclusive !== undefined) input.is_exclusive = body.is_exclusive;

    const adminUserId = (session.user as any)?.id;
    const league = await updateLeague(leagueId, input, adminUserId);

    if (!league) {
      return NextResponse.json({ error: 'Failed to update league' }, { status: 500 });
    }

    return NextResponse.json({ data: league });
  } catch (error) {
    console.error('Error in admin league PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/leagues/[leagueId]
 * Soft delete a league (set is_active = false)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leagueId } = await params;
    const adminUserId = (session.user as any)?.id;

    const success = await softDeleteLeague(leagueId, adminUserId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete league' }, { status: 500 });
    }

    return NextResponse.json({ message: 'League deleted successfully' });
  } catch (error) {
    console.error('Error in admin league DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
