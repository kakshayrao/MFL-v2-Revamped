/**
 * League Activities API
 *
 * GET /api/leagues/[id]/activities - Get activities configured for a league
 * POST /api/leagues/[id]/activities - Add activity to league (host only)
 * DELETE /api/leagues/[id]/activities - Remove activity from league (host only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface LeagueActivity {
  activity_id: string;
  activity_name: string;
  description: string | null;
  category_id: string | null;
  category?: {
    category_id: string;
    category_name: string;
    display_name: string;
  } | null;
  value: string; // Normalized name for workout_type (e.g., "run", "cycling")
}

// ============================================================================
// Utility: Normalize activity name to workout_type value
// ============================================================================

function normalizeActivityName(name: string): string {
  const normalizations: Record<string, string> = {
    'running': 'run',
    'run': 'run',
    'cycling': 'cycling',
    'walking': 'walking',
    'gym workout': 'strength',
    'strength training': 'strength',
    'strength': 'strength',
    'yoga': 'yoga',
    'yoga/stretching': 'yoga',
    'swimming': 'swimming',
    'hiit': 'hiit',
    'cardio': 'cardio',
    'sports': 'sports',
    'steps': 'steps',
    'golf': 'golf',
    'meditation': 'meditation',
    'horse riding': 'horse_riding',
    'badminton': 'badminton_pickleball',
    'pickleball': 'badminton_pickleball',
    'basketball': 'basketball_cricket',
    'cricket': 'basketball_cricket',
  };

  const lower = name.toLowerCase().trim();
  return normalizations[lower] || lower.replace(/\s+/g, '_');
}

// ============================================================================
// GET Handler - Get activities for a league
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';

    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // First check if user is a member of this league
    const { data: membership } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('user_id', session.user.id)
      .eq('league_id', leagueId)
      .maybeSingle();

    // Also check if user is host
    const { data: league } = await supabase
      .from('leagues')
      .select('created_by')
      .eq('league_id', leagueId)
      .single();

    const isHost = league?.created_by === session.user.id;

    // Check if user is Governor in this league
    const { data: roleData } = await supabase
      .from('assignedrolesforleague')
      .select('roles(role_name)')
      .eq('user_id', session.user.id)
      .eq('league_id', leagueId);

    const roleNames = (roleData || []).map((r: any) => r.roles?.role_name).filter(Boolean);
    const isGovernor = roleNames.includes('Governor');

    if (!membership && !isHost && !isGovernor) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    // Get league-specific activities via leagueactivities junction table
    const { data: leagueActivities, error: activitiesError } = await supabase
      .from('leagueactivities')
      .select(`
        activity_id,
        activities(
          activity_id, 
          activity_name, 
          description,
          category_id,
          activity_categories(category_id, category_name, display_name)
        )
      `)
      .eq('league_id', leagueId);

    if (activitiesError) {
      console.error('Error fetching league activities:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Transform enabled activities to LeagueActivity format
    const enabledActivities: LeagueActivity[] = (leagueActivities || [])
      .filter((la) => la.activities) // Filter out any null activities
      .map((la) => {
        const activity = la.activities as any;
        return {
          activity_id: activity.activity_id,
          activity_name: activity.activity_name,
          description: activity.description,
          category_id: activity.category_id,
          category: activity.activity_categories,
          value: normalizeActivityName(activity.activity_name),
        };
      });

    // If host wants all activities (for configuration), fetch them
    let allActivities: LeagueActivity[] = [];
    if (includeAll && isHost) {
      const { data: allActs, error: allError } = await supabase
        .from('activities')
        .select(`
          activity_id, 
          activity_name, 
          description,
          category_id,
          activity_categories(category_id, category_name, display_name)
        `)
        .order('activity_name');

      if (!allError && allActs) {
        allActivities = allActs.map((a: any) => ({
          activity_id: a.activity_id,
          activity_name: a.activity_name,
          description: a.description,
          category_id: a.category_id,
          category: a.activity_categories,
          value: normalizeActivityName(a.activity_name),
        }));
      }
    }

    // If no activities configured and not requesting all, return error for players
    if (enabledActivities.length === 0 && !includeAll) {
      return NextResponse.json({
        success: false,
        error: 'NO_ACTIVITIES_CONFIGURED',
        message: 'This league has no activities configured. Please contact the league host.',
        data: { activities: [], isLeagueSpecific: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        activities: enabledActivities,
        allActivities: includeAll ? allActivities : undefined,
        isLeagueSpecific: true,
        isHost,
      },
    });
  } catch (error) {
    console.error('Error in league activities GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Add activity to league (host only)
// ============================================================================

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

    const userId = session.user.id;
    const supabase = getSupabaseServiceRole();

    // Check if user is host of this league
    const { data: league } = await supabase
      .from('leagues')
      .select('created_by')
      .eq('league_id', leagueId)
      .single();

    if (league?.created_by !== userId) {
      return NextResponse.json(
        { error: 'Only the league host can configure activities' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { activity_ids } = body;

    if (!activity_ids || !Array.isArray(activity_ids) || activity_ids.length === 0) {
      return NextResponse.json(
        { error: 'activity_ids array is required' },
        { status: 400 }
      );
    }

    // Verify all activity IDs exist
    const { data: existingActivities, error: verifyError } = await supabase
      .from('activities')
      .select('activity_id')
      .in('activity_id', activity_ids);

    if (verifyError || !existingActivities) {
      return NextResponse.json(
        { error: 'Failed to verify activities' },
        { status: 500 }
      );
    }

    const validActivityIds = existingActivities.map((a) => a.activity_id);
    const invalidIds = activity_ids.filter((id: string) => !validActivityIds.includes(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid activity IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicates - get existing league activities
    const { data: existing } = await supabase
      .from('leagueactivities')
      .select('activity_id')
      .eq('league_id', leagueId);

    const existingActivityIds = (existing || []).map((e) => e.activity_id);
    const newActivityIds = activity_ids.filter(
      (id: string) => !existingActivityIds.includes(id)
    );

    if (newActivityIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All activities are already configured for this league',
        data: { added: 0 },
      });
    }

    // Insert new league activities
    const insertData = newActivityIds.map((activity_id: string) => ({
      league_id: leagueId,
      activity_id,
      created_by: userId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('leagueactivities')
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('Error adding activities to league:', insertError);
      return NextResponse.json(
        { error: 'Failed to add activities' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Added ${inserted?.length || 0} activities to the league`,
      data: { added: inserted?.length || 0 },
    });
  } catch (error) {
    console.error('Error in league activities POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE Handler - Remove activity from league (host only)
// ============================================================================

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

    const userId = session.user.id;
    const supabase = getSupabaseServiceRole();

    // Check if user is host of this league
    const { data: league } = await supabase
      .from('leagues')
      .select('created_by')
      .eq('league_id', leagueId)
      .single();

    if (league?.created_by !== userId) {
      return NextResponse.json(
        { error: 'Only the league host can configure activities' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { activity_id } = body;

    if (!activity_id) {
      return NextResponse.json(
        { error: 'activity_id is required' },
        { status: 400 }
      );
    }

    // Remove activity from league
    const { error: deleteError } = await supabase
      .from('leagueactivities')
      .delete()
      .eq('league_id', leagueId)
      .eq('activity_id', activity_id);

    if (deleteError) {
      console.error('Error removing activity from league:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove activity' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Activity removed from league',
    });
  } catch (error) {
    console.error('Error in league activities DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
