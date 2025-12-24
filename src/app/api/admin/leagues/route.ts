import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import {
  getAllLeagues,
  createLeague,
} from '@/lib/services/admin';
import type { AdminLeagueFilters, AdminLeagueCreateInput } from '@/types/admin';

/**
 * GET /api/admin/leagues
 * Get all leagues with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filters: AdminLeagueFilters = {
      search: searchParams.get('search') || undefined,
      status: (searchParams.get('status') as any) || 'all',
      is_active: searchParams.get('is_active') === 'true'
        ? true
        : searchParams.get('is_active') === 'false'
        ? false
        : 'all',
    };

    const leagues = await getAllLeagues(filters);
    return NextResponse.json({ data: leagues });
  } catch (error) {
    console.error('Error in admin leagues GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/leagues
 * Create a new league
 */
export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      league_name,
      description,
      start_date,
      end_date,
      num_teams,
      team_size,
      rest_days,
      auto_rest_day_enabled,
      is_public,
      is_exclusive,
    } = body;

    if (!league_name || !start_date || !end_date) {
      return NextResponse.json(
        { error: 'League name, start date, and end date are required' },
        { status: 400 }
      );
    }

    const input: AdminLeagueCreateInput = {
      league_name,
      description: description || null,
      start_date,
      end_date,
      num_teams: num_teams || 4,
      team_size: team_size || 5,
      rest_days: rest_days || 1,
      auto_rest_day_enabled: auto_rest_day_enabled ?? false,
      is_public: is_public || false,
      is_exclusive: is_exclusive ?? true,
    };

    const adminUserId = (session.user as any)?.id;
    const league = await createLeague(input, adminUserId);

    if (!league) {
      return NextResponse.json({ error: 'Failed to create league' }, { status: 500 });
    }

    return NextResponse.json({ data: league }, { status: 201 });
  } catch (error) {
    console.error('Error in admin leagues POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
