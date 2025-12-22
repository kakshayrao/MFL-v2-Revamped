-- =====================================================================================
-- Migration: Row Level Security Policies & Helper Functions
-- Description: Implements role-based access control using Supabase RLS
-- Author: MFL Engineering Team
-- Created: 2024-12-14
-- =====================================================================================
-- This migration enables RLS on all tables and defines policies based on user roles:
-- - Host: Full access to their league data
-- - Governor: Full read access to governed leagues, validation permissions
-- - Captain: Full access to own team data, read access to league leaderboards
-- - Player: Full access to own data, read access to team data
-- =====================================================================================

-- =====================================================================================
-- HELPER FUNCTIONS FOR ROLE CHECKING (SECURITY DEFINER)
-- =====================================================================================

/**
 * get_user_roles_in_league: Returns array of role names for a user in a league
 */
CREATE OR REPLACE FUNCTION public.get_user_roles_in_league(p_user_id uuid, p_league_id uuid)
RETURNS TEXT[] AS $$
  SELECT COALESCE(ARRAY_AGG(r.role_name), ARRAY[]::TEXT[])
  FROM public.assignedrolesforleague arl
  INNER JOIN public.roles r ON arl.role_id = r.role_id
  WHERE arl.user_id = p_user_id AND arl.league_id = p_league_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

/**
 * is_host: Check if user is Host (creator/admin) of a league
 */
CREATE OR REPLACE FUNCTION public.is_host(p_user_id uuid, p_league_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignedrolesforleague arl
    INNER JOIN public.roles r ON arl.role_id = r.role_id
    WHERE arl.user_id = p_user_id
      AND arl.league_id = p_league_id
      AND r.role_name = 'Host'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

/**
 * is_governor: Check if user is Governor (approver) of a league
 */
CREATE OR REPLACE FUNCTION public.is_governor(p_user_id uuid, p_league_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignedrolesforleague arl
    INNER JOIN public.roles r ON arl.role_id = r.role_id
    WHERE arl.user_id = p_user_id
      AND arl.league_id = p_league_id
      AND r.role_name = 'Governor'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

/**
 * is_captain_of_team: Check if user is Captain of a specific team
 */
CREATE OR REPLACE FUNCTION public.is_captain_of_team(p_user_id uuid, p_team_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teammembers tm
    INNER JOIN public.roles r ON tm.role_id = r.role_id
    WHERE tm.user_id = p_user_id
      AND tm.team_id = p_team_id
      AND r.role_name = 'Captain'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

/**
 * get_user_team_in_league: Returns team_id for user in a league
 */
CREATE OR REPLACE FUNCTION public.get_user_team_in_league(p_user_id uuid, p_league_id uuid)
RETURNS uuid AS $$
  SELECT lm.team_id
  FROM public.leaguemembers lm
  WHERE lm.user_id = p_user_id
    AND lm.league_id = p_league_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

/**
 * is_member_of_league: Check if user is a member of a league
 */
CREATE OR REPLACE FUNCTION public.is_member_of_league(p_user_id uuid, p_league_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leaguemembers lm
    WHERE lm.user_id = p_user_id
      AND lm.league_id = p_league_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

/**
 * get_league_member_id: Returns league_member_id for a user in a league
 */
CREATE OR REPLACE FUNCTION public.get_league_member_id(p_user_id uuid, p_league_id uuid)
RETURNS uuid AS $$
  SELECT lm.league_member_id
  FROM public.leaguemembers lm
  WHERE lm.user_id = p_user_id
    AND lm.league_id = p_league_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagueactivities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagueinvites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teamleagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaguemembers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignedrolesforleague ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teammembers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.effortentry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialchallenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagueschallenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_subteams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_subteam_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialchallengeindividualuserscore ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialchallengeteamscore ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =====================================================================================
-- USERS TABLE POLICIES
-- =====================================================================================

-- Users can view their own profile
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view other users (for team rosters, leaderboards)
CREATE POLICY users_select_public ON public.users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can update their own profile (except platform_role)
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND platform_role = (SELECT platform_role FROM public.users WHERE user_id = auth.uid()));

-- Only admins can update platform_role
CREATE POLICY users_update_role_admin ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- EMAIL OTP POLICIES
-- =====================================================================================

-- Service role only for signup
CREATE POLICY email_otps_insert_service ON public.email_otps
  FOR INSERT
  WITH CHECK (true);

-- Users can view their own OTPs
CREATE POLICY email_otps_select_own ON public.email_otps
  FOR SELECT
  USING (auth.uid()::text IS NOT NULL);

-- =====================================================================================
-- PRICING POLICIES
-- =====================================================================================

-- Everyone can read pricing
CREATE POLICY pricing_select_all ON public.pricing
  FOR SELECT
  USING (true);

-- Only admins can modify pricing
CREATE POLICY pricing_insert_admin ON public.pricing
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

CREATE POLICY pricing_update_admin ON public.pricing
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

CREATE POLICY pricing_delete_admin ON public.pricing
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- ROLES POLICIES
-- =====================================================================================

-- Everyone can read roles
CREATE POLICY roles_select_all ON public.roles
  FOR SELECT
  USING (true);

-- Only admins can modify roles
CREATE POLICY roles_insert_admin ON public.roles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

CREATE POLICY roles_update_admin ON public.roles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- LEAGUES POLICIES
-- =====================================================================================

-- Everyone can read public leagues
CREATE POLICY leagues_select_public ON public.leagues
  FOR SELECT
  USING (is_public = true OR is_active = false);

-- Members can read their leagues
CREATE POLICY leagues_select_member ON public.leagues
  FOR SELECT
  USING (public.is_member_of_league(auth.uid(), league_id));

-- Hosts can insert new leagues
CREATE POLICY leagues_insert_user ON public.leagues
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Host can update own leagues
CREATE POLICY leagues_update_host ON public.leagues
  FOR UPDATE
  USING (public.is_host(auth.uid(), league_id))
  WITH CHECK (public.is_host(auth.uid(), league_id));

-- Admin can update any league
CREATE POLICY leagues_update_admin ON public.leagues
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- ACTIVITY CATEGORIES POLICIES
-- =====================================================================================

-- Everyone can read categories
CREATE POLICY activity_categories_select_all ON public.activity_categories
  FOR SELECT
  USING (true);

-- Only admins can insert categories
CREATE POLICY activity_categories_insert_admin ON public.activity_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- Only admins can update categories
CREATE POLICY activity_categories_update_admin ON public.activity_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- Only admins can delete categories
CREATE POLICY activity_categories_delete_admin ON public.activity_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- ACTIVITIES POLICIES
-- =====================================================================================

-- Everyone can read activities
CREATE POLICY activities_select_all ON public.activities
  FOR SELECT
  USING (true);

-- Only admins can modify activities
CREATE POLICY activities_insert_admin ON public.activities
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

CREATE POLICY activities_update_admin ON public.activities
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- LEAGUE ACTIVITIES POLICIES
-- =====================================================================================

-- League members can read league activities
CREATE POLICY leagueactivities_select_member ON public.leagueactivities
  FOR SELECT
  USING (public.is_member_of_league(auth.uid(), league_id));

-- Host can manage league activities
CREATE POLICY leagueactivities_insert_host ON public.leagueactivities
  FOR INSERT
  WITH CHECK (public.is_host(auth.uid(), league_id));

CREATE POLICY leagueactivities_delete_host ON public.leagueactivities
  FOR DELETE
  USING (public.is_host(auth.uid(), league_id));

-- =====================================================================================
-- LEAGUE INVITES POLICIES
-- =====================================================================================

-- Users can read their invites
CREATE POLICY leagueinvites_select_own ON public.leagueinvites
  FOR SELECT
  USING (user_id = auth.uid());

-- Host can send invites
CREATE POLICY leagueinvites_insert_host ON public.leagueinvites
  FOR INSERT
  WITH CHECK (public.is_host(auth.uid(), league_id));

-- =====================================================================================
-- TEAMS POLICIES
-- =====================================================================================

-- Everyone can read teams
CREATE POLICY teams_select_all ON public.teams
  FOR SELECT
  USING (true);

-- Users can create teams
CREATE POLICY teams_insert_user ON public.teams
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Team creator can update own team
CREATE POLICY teams_update_own ON public.teams
  FOR UPDATE
  USING (created_by = auth.uid());

-- =====================================================================================
-- TEAM LEAGUES POLICIES
-- =====================================================================================

-- Everyone can read team league associations
CREATE POLICY teamleagues_select_all ON public.teamleagues
  FOR SELECT
  USING (true);

-- Host can manage team leagues
CREATE POLICY teamleagues_insert_host ON public.teamleagues
  FOR INSERT
  WITH CHECK (public.is_host(auth.uid(), league_id));

CREATE POLICY teamleagues_delete_host ON public.teamleagues
  FOR DELETE
  USING (public.is_host(auth.uid(), league_id));

-- =====================================================================================
-- LEAGUE MEMBERS POLICIES
-- =====================================================================================

-- Users can read their league memberships
CREATE POLICY leaguemembers_select_own ON public.leaguemembers
  FOR SELECT
  USING (user_id = auth.uid());

-- Members can read other members in their league
CREATE POLICY leaguemembers_select_league ON public.leaguemembers
  FOR SELECT
  USING (public.is_member_of_league(auth.uid(), league_id));

-- Host can insert league members
CREATE POLICY leaguemembers_insert_host ON public.leaguemembers
  FOR INSERT
  WITH CHECK (public.is_host(auth.uid(), league_id));

-- User can update own team assignment
CREATE POLICY leaguemembers_update_own ON public.leaguemembers
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND team_id IS NOT NULL);

-- Host can update member team assignment
CREATE POLICY leaguemembers_update_host ON public.leaguemembers
  FOR UPDATE
  USING (public.is_host(auth.uid(), league_id))
  WITH CHECK (public.is_host(auth.uid(), league_id));

-- =====================================================================================
-- ASSIGNED ROLES FOR LEAGUE POLICIES
-- =====================================================================================

-- Users can read roles assigned in their leagues
CREATE POLICY assignedrolesforleague_select_member ON public.assignedrolesforleague
  FOR SELECT
  USING (public.is_member_of_league(auth.uid(), league_id));

-- Host can assign roles in their league
CREATE POLICY assignedrolesforleague_insert_host ON public.assignedrolesforleague
  FOR INSERT
  WITH CHECK (public.is_host(auth.uid(), league_id));

CREATE POLICY assignedrolesforleague_delete_host ON public.assignedrolesforleague
  FOR DELETE
  USING (public.is_host(auth.uid(), league_id));

-- =====================================================================================
-- TEAM MEMBERS POLICIES
-- =====================================================================================

-- Users can read team membership
CREATE POLICY teammembers_select_all ON public.teammembers
  FOR SELECT
  USING (true);

-- Captain can manage team members
CREATE POLICY teammembers_insert_captain ON public.teammembers
  FOR INSERT
  WITH CHECK (public.is_captain_of_team(auth.uid(), team_id));

CREATE POLICY teammembers_delete_captain ON public.teammembers
  FOR DELETE
  USING (public.is_captain_of_team(auth.uid(), team_id));

-- =====================================================================================
-- EFFORT ENTRY POLICIES
-- =====================================================================================

-- Users can read their own effort entries
CREATE POLICY effortentry_select_own ON public.effortentry
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      WHERE lm.league_member_id = effortentry.league_member_id
      AND lm.user_id = auth.uid()
    )
  );

-- Members can read team/league effort entries
CREATE POLICY effortentry_select_league ON public.effortentry
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      WHERE lm.league_member_id = effortentry.league_member_id
      AND public.is_member_of_league(auth.uid(), lm.league_id)
    )
  );

-- Users can insert own effort entries
CREATE POLICY effortentry_insert_own ON public.effortentry
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      WHERE lm.league_member_id = effortentry.league_member_id
      AND lm.user_id = auth.uid()
    )
  );

-- Captain/Governor can update effort entries
CREATE POLICY effortentry_update_captain ON public.effortentry
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      INNER JOIN public.teams t ON lm.team_id = t.team_id
      WHERE lm.league_member_id = effortentry.league_member_id
      AND public.is_captain_of_team(auth.uid(), t.team_id)
    )
  );

CREATE POLICY effortentry_update_governor ON public.effortentry
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      WHERE lm.league_member_id = effortentry.league_member_id
      AND public.is_governor(auth.uid(), lm.league_id)
    )
  );

-- =====================================================================================
-- SPECIAL CHALLENGES POLICIES
-- =====================================================================================

-- Everyone can read challenges
CREATE POLICY specialchallenges_select_all ON public.specialchallenges
  FOR SELECT
  USING (true);

-- Only admins can modify challenges
CREATE POLICY specialchallenges_insert_admin ON public.specialchallenges
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

CREATE POLICY specialchallenges_update_admin ON public.specialchallenges
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- LEAGUES CHALLENGES POLICIES
-- =====================================================================================

-- Members can read league challenges
CREATE POLICY leagueschallenges_select_member ON public.leagueschallenges
  FOR SELECT
  USING (public.is_member_of_league(auth.uid(), league_id));

-- Host can manage league challenges
CREATE POLICY leagueschallenges_insert_host ON public.leagueschallenges
  FOR INSERT
  WITH CHECK (public.is_host(auth.uid(), league_id));

CREATE POLICY leagueschallenges_update_host ON public.leagueschallenges
  FOR UPDATE
  USING (public.is_host(auth.uid(), league_id))
  WITH CHECK (public.is_host(auth.uid(), league_id));

CREATE POLICY leagueschallenges_delete_host ON public.leagueschallenges
  FOR DELETE
  USING (public.is_host(auth.uid(), league_id));

-- =====================================================================================
-- CHALLENGE SUBTEAMS POLICIES
-- =====================================================================================

-- Members can read challenge subteams
CREATE POLICY challenge_subteams_select_member ON public.challenge_subteams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagueschallenges lc
      WHERE lc.id = challenge_subteams.league_challenge_id
      AND public.is_member_of_league(auth.uid(), lc.league_id)
    )
  );

-- Host can manage subteams
CREATE POLICY challenge_subteams_insert_host ON public.challenge_subteams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leagueschallenges lc
      WHERE lc.id = challenge_subteams.league_challenge_id
      AND public.is_host(auth.uid(), lc.league_id)
    )
  );

-- =====================================================================================
-- CHALLENGE SUBTEAM MEMBERS POLICIES
-- =====================================================================================

-- Members can read subteam memberships
CREATE POLICY challenge_subteam_members_select_member ON public.challenge_subteam_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.challenge_subteams cs
      INNER JOIN public.leagueschallenges lc ON cs.league_challenge_id = lc.id
      WHERE cs.subteam_id = challenge_subteam_members.subteam_id
      AND public.is_member_of_league(auth.uid(), lc.league_id)
    )
  );

-- Host can manage subteam members
CREATE POLICY challenge_subteam_members_insert_host ON public.challenge_subteam_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.challenge_subteams cs
      INNER JOIN public.leagueschallenges lc ON cs.league_challenge_id = lc.id
      WHERE cs.subteam_id = challenge_subteam_members.subteam_id
      AND public.is_host(auth.uid(), lc.league_id)
    )
  );

-- =====================================================================================
-- CHALLENGE SUBMISSIONS POLICIES
-- =====================================================================================

-- Users can read their own submissions
CREATE POLICY challenge_submissions_select_own ON public.challenge_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      WHERE lm.league_member_id = challenge_submissions.league_member_id
      AND lm.user_id = auth.uid()
    )
  );

-- Members can read all submissions in their league challenges
CREATE POLICY challenge_submissions_select_league ON public.challenge_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leagueschallenges lc
      WHERE lc.id = challenge_submissions.league_challenge_id
      AND public.is_member_of_league(auth.uid(), lc.league_id)
    )
  );

-- Users can submit challenges
CREATE POLICY challenge_submissions_insert_user ON public.challenge_submissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaguemembers lm
      WHERE lm.league_member_id = challenge_submissions.league_member_id
      AND lm.user_id = auth.uid()
    )
  );

-- Governor/Host can review submissions
CREATE POLICY challenge_submissions_update_reviewer ON public.challenge_submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leagueschallenges lc
      WHERE lc.id = challenge_submissions.league_challenge_id
      AND (
        public.is_host(auth.uid(), lc.league_id)
        OR public.is_governor(auth.uid(), lc.league_id)
      )
    )
  );

-- =====================================================================================
-- SPECIAL CHALLENGE INDIVIDUAL USER SCORE POLICIES
-- =====================================================================================

-- Everyone can read scores
CREATE POLICY specialchallengeindividualuserscore_select_all ON public.specialchallengeindividualuserscore
  FOR SELECT
  USING (true);

-- Only admins can modify scores
CREATE POLICY specialchallengeindividualuserscore_insert_admin ON public.specialchallengeindividualuserscore
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- SPECIAL CHALLENGE TEAM SCORE POLICIES
-- =====================================================================================

-- Everyone can read team scores
CREATE POLICY specialchallengeteamscore_select_all ON public.specialchallengeteamscore
  FOR SELECT
  USING (true);

-- Only admins can modify team scores
CREATE POLICY specialchallengeteamscore_insert_admin ON public.specialchallengeteamscore
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- =====================================================================================
-- PAYMENTS POLICIES
-- =====================================================================================

-- Users can read their own payments
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT
  USING (user_id = auth.uid());

-- Admin can read all payments
CREATE POLICY payments_select_admin ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.user_id = auth.uid()
      AND users.platform_role = 'admin'
    )
  );

-- Users can insert their own payments
CREATE POLICY payments_insert_user ON public.payments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- System can update payment status (via service role)
CREATE POLICY payments_update_all ON public.payments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- =====================================================================================
-- GRANTS (SCHEMA & TABLE ACCESS)
-- =====================================================================================

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant SELECT on all public tables to authenticated
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant INSERT, UPDATE, DELETE on specific tables to authenticated
GRANT INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leaguemembers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.leagueactivities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.effortentry TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.challenge_submissions TO authenticated;
GRANT INSERT ON public.payments TO authenticated;
GRANT UPDATE ON public.payments TO authenticated;

-- Grant EXECUTE on helper functions to authenticated
GRANT EXECUTE ON FUNCTION public.get_user_roles_in_league(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_host(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_governor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_captain_of_team(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_team_in_league(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_league(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_league_member_id(uuid, uuid) TO authenticated;

-- =====================================================================================
-- END OF RLS POLICIES
-- =====================================================================================
