/**
 * GET /api/leagues - List user's leagues
 * POST /api/leagues - Create a new league (Host role required)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getLeaguesForUser, createLeague } from '@/lib/services/leagues';
import { z } from 'zod';

const createLeagueSchema = z.object({
  league_name: z.string().min(1, 'League name required'),
  description: z.string().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  tier_id: z.string().optional(),
  num_teams: z.number().int().positive().optional(),
  max_participants: z.number().int().positive().optional(),
  rest_days: z.number().int().min(0).max(7).optional(),
  is_public: z.boolean().optional(),
  is_exclusive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leagues = await getLeaguesForUser(session.user.id);
    return NextResponse.json({ data: leagues, success: true });
  } catch (error) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leagues' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validated = createLeagueSchema.parse(body);

    // Validate dates
    const startDate = new Date(validated.start_date);
    const endDate = new Date(validated.end_date);
    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date must be on or after start date' },
        { status: 400 }
      );
    }

    const league = await createLeague(session.user.id, validated);
    if (!league) {
      return NextResponse.json(
        { error: 'Failed to create league' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: league, success: true },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating league:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create league' },
      { status: 500 }
    );
  }
}

