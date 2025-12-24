/**
 * POST /api/cron/auto-rest-day - Auto-assign rest days for missing submissions
 * 
 * This cron job runs ONCE PER DAY at 23:59 UTC and processes leagues with auto_rest_day_enabled=true.
 * For each league member with rest days remaining:
 * - Calculate their local "yesterday" based on league timezone (or UTC if not set)
 * - Check if they have submission for that day → skip if yes
 * - If no submission and rest days available, auto-assign as rest day (approved)
 * 
 * By running at 23:59 UTC daily, this catches missing submissions across all global timezones
 * consistently and fairly.
 * 
 * Security: Validates CRON_SECRET header from Vercel
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// Configuration
// ============================================================================

const AUTO_REST_DAYS_BATCH_SIZE = 100; // Process in batches for performance

// ============================================================================
// Helper: Calculate yesterday in a given timezone offset
// ============================================================================

function getYesterdayInTimezone(utcOffsetHours: number = 0): string {
  const now = new Date();
  // Adjust to timezone
  const localTime = new Date(now.getTime() + utcOffsetHours * 60 * 60 * 1000);
  // Get yesterday in local timezone
  const yesterday = new Date(localTime);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============================================================================
// Helper: Parse timezone offset string (e.g., "UTC+5:30", "EST", etc.)
// Returns offset in hours
// ============================================================================

function parseTimezoneOffset(tzString: string | null): number {
  if (!tzString) return 0; // Default to UTC

  // Handle "UTC+X:XX" or "UTC-X:XX" format
  const match = tzString.match(/UTC([+-])(\d+):?(\d*)/i);
  if (match) {
    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours + minutes / 60);
  }

  // Default timezones
  const tzMap: Record<string, number> = {
    IST: 5.5, // India Standard Time
    EST: -5,
    EDT: -4,
    CST: -6,
    CDT: -5,
    MST: -7,
    MDT: -6,
    PST: -8,
    PDT: -7,
    GMT: 0,
    UTC: 0,
  };

  return tzMap[tzString.toUpperCase()] || 0;
}

// ============================================================================
// Helper: Check if member has rest days remaining
// ============================================================================

async function getMemberRestDaysRemaining(
  leagueMemberId: string,
  leagueId: string,
  restDaysPerWeek: number
): Promise<number> {
  const supabase = getSupabaseServiceRole();

  // Get league dates
  const { data: league } = await supabase
    .from('leagues')
    .select('start_date, end_date')
    .eq('league_id', leagueId)
    .single();

  if (!league) return 0;

  // Calculate total allowed rest days
  const startDate = new Date(league.start_date);
  const endDate = new Date(league.end_date);
  const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const totalAllowed = weeks * restDaysPerWeek;

  // Count approved rest days
  const { count: approvedRestDays } = await supabase
    .from('effortentry')
    .select('*', { count: 'exact', head: true })
    .eq('league_member_id', leagueMemberId)
    .eq('type', 'rest')
    .eq('status', 'approved');

  const used = approvedRestDays || 0;
  return Math.max(0, totalAllowed - used);
}

// ============================================================================
// Helper: Check if member already has an entry for a specific date
// ============================================================================

async function hasEntryForDate(leagueMemberId: string, dateStr: string): Promise<boolean> {
  const supabase = getSupabaseServiceRole();

  const { data } = await supabase
    .from('effortentry')
    .select('id', { count: 'exact', head: true })
    .eq('league_member_id', leagueMemberId)
    .eq('date', dateStr);

  return !!data;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized auto-rest-day cron attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();
    let totalAssigned = 0;
    let totalProcessed = 0;

    // Step 1: Get all active leagues with auto_rest_day_enabled = true
    // Note: Leagues table currently doesn't have timezone field, so we use UTC for now
    // TODO: Add timezone column to leagues table for per-league timezone support
    const { data: enabledLeagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('league_id, rest_days, status')
      .eq('auto_rest_day_enabled', true)
      .eq('is_active', true)
      .in('status', ['active', 'launched']);

    if (leaguesError) {
      console.error('Error fetching leagues with auto rest enabled:', leaguesError);
      return NextResponse.json(
        { error: 'Failed to fetch leagues' },
        { status: 500 }
      );
    }

    if (!enabledLeagues || enabledLeagues.length === 0) {
      console.log('No leagues with auto rest day enabled');
      return NextResponse.json({
        success: true,
        message: 'No leagues with auto rest day enabled',
        assigned: 0,
      });
    }

    // Step 2: Process each league
    for (const league of enabledLeagues) {
      console.log(`Processing league ${league.league_id} with rest_days=${league.rest_days}`);

      // For now, use UTC. Once timezone column is added to leagues, use that instead.
      const leagueTimezoneOffset = 0; // UTC offset in hours

      // Get all active members in this league
      const { data: members, error: membersError } = await supabase
        .from('leaguemembers')
        .select('league_member_id, user_id')
        .eq('league_id', league.league_id)
        .eq('is_active', true);

      if (membersError) {
        console.error(`Error fetching members for league ${league.league_id}:`, membersError);
        continue;
      }

      if (!members || members.length === 0) continue;

      // Step 3: Check each member
      for (const member of members) {
        totalProcessed++;

        try {
          // Calculate yesterday in league's timezone
          const yesterdayStr = getYesterdayInTimezone(leagueTimezoneOffset);

          // Check if member already has entry for yesterday
          const hasEntry = await hasEntryForDate(member.league_member_id, yesterdayStr);
          if (hasEntry) {
            // Already submitted something yesterday, skip
            continue;
          }

          // Check remaining rest days
          const restDaysRemaining = await getMemberRestDaysRemaining(
            member.league_member_id,
            league.league_id,
            league.rest_days
          );

          if (restDaysRemaining <= 0) {
            // No rest days remaining
            continue;
          }

          // Auto-create rest day entry for yesterday (in league's timezone)
          const { error: insertError } = await supabase
            .from('effortentry')
            .insert({
              league_member_id: member.league_member_id,
              date: yesterdayStr,
              type: 'rest',
              status: 'approved',
              rr_value: 1.0,
              created_by: null, // System auto-assignment
              modified_by: null,
              notes: 'Auto-assigned rest day via cron (missed deadline)',
            });

          if (!insertError) {
            totalAssigned++;
            console.log(
              `Auto-assigned rest day for ${yesterdayStr} to member ${member.league_member_id} in league ${league.league_id}`
            );
          } else {
            console.error(
              `Failed to auto-assign rest day for ${member.league_member_id}:`,
              insertError
            );
          }
        } catch (memberErr) {
          console.error(
            `Error processing member ${member.league_member_id}:`,
            memberErr
          );
          // Continue to next member
        }
      }
    }

    console.log(
      `Auto-rest-day cron completed: ${totalAssigned} assigned out of ${totalProcessed} members processed`
    );

    return NextResponse.json({
      success: true,
      message: `Auto-assigned ${totalAssigned} rest days`,
      assigned: totalAssigned,
      processed: totalProcessed,
    });
  } catch (error) {
    console.error('Error in auto-rest-day cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing (development only)
export async function GET(req: NextRequest) {
  // In production, only allow POST from Vercel cron
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Use POST for cron execution' },
      { status: 405 }
    );
  }

  // In development, allow GET for testing
  return POST(req);
}
