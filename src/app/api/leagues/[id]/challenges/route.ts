import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// Shared helpers ------------------------------------------------------------
type LeagueRole = 'host' | 'governor' | 'captain' | 'player' | null;

type Membership = {
  leagueMemberId: string;
  role: LeagueRole;
};

async function getMembership(userId: string, leagueId: string): Promise<Membership | null> {
  const supabase = getSupabaseServiceRole();
  
  // First check if user is a league member
  const { data: memberData, error: memberError } = await supabase
    .from('leaguemembers')
    .select('league_member_id')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();

  if (memberError || !memberData) {
    console.warn(`User ${userId} is not a member of league ${leagueId}`);
    return null;
  }

  // Then fetch the user's roles in this league
  const { data: roleData, error: roleError } = await supabase
    .from('assignedrolesforleague')
    .select('roles(role_name)')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

  if (roleError) {
    console.error(`Error fetching roles for user ${userId} in league ${leagueId}:`, roleError);
    return null;
  }

  // Get the first role (or highest priority role if multiple)
  const roleNames = (roleData || []).map((r: any) => r.roles?.role_name).filter(Boolean);
  const primaryRole = (roleNames[0] as LeagueRole) ?? null;

  return {
    leagueMemberId: String(memberData.league_member_id),
    role: primaryRole,
  };
}

function isHostOrGovernor(role: LeagueRole): boolean {
  return role === 'host' || role === 'governor';
}

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET - List league challenges with optional user submission state ---------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership) {
      console.error(`Membership check failed for userId=${session.user.id}, leagueId=${leagueId}`);
      return buildError('Not a member of this league', 403);
    }

    // Fetch active challenges for this league
    const { data: challenges, error } = await supabase
      .from('leagueschallenges')
      .select(
        `
        id,
        league_id,
        challenge_id,
        name,
        description,
        challenge_type,
        total_points,
        is_custom,
        payment_id,
        doc_url,
        start_date,
        end_date,
        status,
        updated_at,
        specialchallenges(name, description, doc_url)
      `
      )
      .eq('league_id', leagueId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching league challenges', error);
      return buildError('Failed to fetch challenges', 500);
    }

    const challengeIds = (challenges || []).map((c) => c.id);

    // If host/governor fetch aggregate stats for each challenge
    let statsByChallenge: Record<string, { pending: number; approved: number; rejected: number }> = {};
    if (isHostOrGovernor(membership.role) && challengeIds.length) {
      const { data: submissions, error: statsError } = await supabase
        .from('challenge_submissions')
        .select('league_challenge_id, status')
        .in('league_challenge_id', challengeIds);

      if (!statsError && submissions) {
        // Aggregate submissions by challenge_id and status
        submissions.forEach((submission: any) => {
          const challengeId = String(submission.league_challenge_id);
          if (!statsByChallenge[challengeId]) {
            statsByChallenge[challengeId] = { pending: 0, approved: 0, rejected: 0 };
          }
          const statusKey = submission.status as 'pending' | 'approved' | 'rejected';
          statsByChallenge[challengeId][statusKey]++;
        });
      }
    }

    // Fetch the requesting member's submission per challenge
    let mySubmissions: Record<string, any> = {};
    if (challengeIds.length) {
      const { data: subs, error: subsError } = await supabase
        .from('challenge_submissions')
        .select('*')
        .in('league_challenge_id', challengeIds)
        .eq('league_member_id', membership.leagueMemberId);

      if (!subsError && subs) {
        subs.forEach((s) => {
          mySubmissions[String(s.league_challenge_id)] = s;
        });
      }
    }

    const activePayload = (challenges || []).map((c) => {
      const template = (c as any).specialchallenges;
      const challengeId = String(c.id);
      return {
        id: challengeId,
        league_id: c.league_id,
        name: c.name || template?.name || 'Challenge',
        description: c.description || null,
        challenge_type: c.challenge_type,
        total_points: Number(c.total_points || template?.total_points || 0),
        is_custom: !!c.is_custom,
        payment_id: c.payment_id,
        doc_url: c.doc_url || template?.doc_url || null,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        template_id: c.challenge_id,
        my_submission: mySubmissions[challengeId] || null,
        stats: statsByChallenge[challengeId] || null,
      };
    });

    // Fetch available preset challenges (admin templates) that haven't been activated yet
    let availablePresets: any[] = [];
    if (isHostOrGovernor(membership.role)) {
      const activatedTemplateIds = (challenges || [])
        .map((c) => c.challenge_id)
        .filter((id) => id !== null);

      let presetsQuery = supabase
        .from('specialchallenges')
        .select('*')
        .order('created_date', { ascending: false });

      if (activatedTemplateIds.length > 0) {
        presetsQuery = presetsQuery.not('challenge_id', 'in', `(${activatedTemplateIds.join(',')})`);
      }

      const { data: presets, error: presetsError } = await presetsQuery;
      if (!presetsError && presets) {
        availablePresets = presets.map((p) => ({
          id: p.challenge_id,
          name: p.name,
          description: p.description,
          doc_url: p.doc_url,
          challenge_type: p.challenge_type,
          is_preset: true,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        active: activePayload,
        availablePresets,
      },
    });
  } catch (err) {
    console.error('Unexpected error in GET /challenges', err);
    return buildError('Internal server error', 500);
  }
}

// POST - Create a league-scoped challenge (requires payment if custom) --
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership || !isHostOrGovernor(membership.role)) {
      return buildError('Forbidden', 403);
    }

    const body = await req.json();
    const {
      name,
      description,
      challengeType = 'individual',
      totalPoints = 0,
      startDate,
      endDate,
      docUrl,
      templateId,
      isCustom = false,
      status = 'active',
    } = body;

    if (!name && !templateId) {
      return buildError('Name or templateId is required', 400);
    }

    // If custom challenge, require payment first (return payment request)
    if (isCustom && totalPoints > 0) {
      return NextResponse.json({
        success: false,
        requiresPayment: true,
        message: 'Custom challenges require payment. Complete payment first.',
        challenge: {
          name,
          description,
          challengeType,
          totalPoints,
          startDate,
          endDate,
          docUrl,
          status,
        },
      }, { status: 402 }); // 402 Payment Required
    }

    // Note: Preset-based challenges (isCustom = false) do NOT require payment

    const insertPayload: Record<string, any> = {
      league_id: leagueId,
      name,
      description,
      challenge_type: challengeType,
      total_points: totalPoints,
      start_date: startDate,
      end_date: endDate,
      doc_url: docUrl,
      challenge_id: templateId ?? null,
      is_custom: isCustom,
      payment_id: null, // Would be set after payment succeeds
      status,
    };

    const { data, error } = await supabase
      .from('leagueschallenges')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating league challenge', error);
      return buildError('Failed to create challenge', 500);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Unexpected error in POST /challenges', err);
    return buildError('Internal server error', 500);
  }
}
