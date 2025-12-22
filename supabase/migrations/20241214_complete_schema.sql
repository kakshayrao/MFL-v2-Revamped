-- =====================================================================================
-- Migration: Complete Database Schema for MyFitnessLeague V2
-- Description: Creates all core tables, enums, indexes, and triggers
-- Author: MFL Engineering Team
-- Created: 2024-12-14
-- =====================================================================================

-- Enable UUID extension for primary key generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================================
-- ENUMS & CUSTOM TYPES
-- =====================================================================================

CREATE TYPE effort_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE platform_role AS ENUM ('admin', 'user');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_purpose AS ENUM ('league_creation', 'subscription', 'other', 'challenge_creation');
CREATE TYPE challenge_status AS ENUM ('active', 'upcoming', 'closed');

-- =====================================================================================
-- CORE USER MANAGEMENT
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar NOT NULL UNIQUE CHECK (char_length(username) >= 3),
  email varchar NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  password_hash varchar NOT NULL,
  phone varchar,
  date_of_birth date,
  gender varchar,
  platform_role platform_role DEFAULT 'user',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_username_key UNIQUE (username),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

COMMENT ON TABLE public.users IS 'Core user accounts with authentication and profile data';
COMMENT ON COLUMN public.users.platform_role IS 'Platform-level role: admin (super admin) or user (regular user)';
COMMENT ON COLUMN public.users.is_active IS 'Soft delete flag - false indicates deactivated account';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.email_otps (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_otps_expiry_future CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_used ON public.email_otps(email, used);

COMMENT ON TABLE public.email_otps IS 'Temporary OTP storage for email verification during signup';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_price numeric NOT NULL CHECK (base_price >= 0),
  platform_fee numeric NOT NULL CHECK (platform_fee >= 0),
  gst_percentage numeric NOT NULL CHECK (gst_percentage >= 0 AND gst_percentage <= 100),
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_active ON public.pricing(is_active);

COMMENT ON TABLE public.pricing IS 'Dynamic pricing configuration for league creation fees';

-- =====================================================================================
-- ROLE & PERMISSION SYSTEM
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name varchar NOT NULL UNIQUE CHECK (char_length(role_name) > 0),
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(role_name);

COMMENT ON TABLE public.roles IS 'Role definitions for role-based access control (Host, Governor, Captain, Player)';

-- =====================================================================================
-- LEAGUE MANAGEMENT
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.leagues (
  league_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_name varchar NOT NULL UNIQUE CHECK (char_length(league_name) >= 3),
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar DEFAULT 'draft' CHECK (status IN ('draft', 'launched', 'active', 'completed')),
  is_active boolean DEFAULT true,
  num_teams integer DEFAULT 4 CHECK (num_teams > 0),
  team_size integer DEFAULT 5 CHECK (team_size > 0),
  rest_days integer DEFAULT 1 CHECK (rest_days >= 0 AND rest_days <= 7),
  is_public boolean DEFAULT false,
  is_exclusive boolean DEFAULT true,
  invite_code varchar UNIQUE,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leagues_active ON public.leagues(is_active);
CREATE INDEX IF NOT EXISTS idx_leagues_dates ON public.leagues(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leagues_status ON public.leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_leagues_public ON public.leagues(is_public) WHERE is_public = true;

COMMENT ON TABLE public.leagues IS 'League instances with start/end dates and status';
COMMENT ON COLUMN public.leagues.is_active IS 'Soft delete flag - false indicates deactivated league';
COMMENT ON COLUMN public.leagues.status IS 'League lifecycle: draft → launched → active → completed';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.activity_categories (
  category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  display_order integer DEFAULT 0,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_categories_name ON public.activity_categories(category_name);
CREATE INDEX IF NOT EXISTS idx_activity_categories_order ON public.activity_categories(display_order);

COMMENT ON TABLE public.activity_categories IS 'Master list of activity categories for filtering and organization';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.activities (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name varchar NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES public.activity_categories(category_id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_name ON public.activities(activity_name);
CREATE INDEX IF NOT EXISTS idx_activities_category ON public.activities(category_id);

COMMENT ON TABLE public.activities IS 'Master list of available workout/activity types';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.leagueactivities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.activities(activity_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT unique_league_activity UNIQUE (league_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_leagueactivities_league ON public.leagueactivities(league_id);
CREATE INDEX IF NOT EXISTS idx_leagueactivities_activity ON public.leagueactivities(activity_id);

COMMENT ON TABLE public.leagueactivities IS 'Defines which activities are allowed in each league';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.leagueinvites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  invited_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT unique_league_invite UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_leagueinvites_league ON public.leagueinvites(league_id);
CREATE INDEX IF NOT EXISTS idx_leagueinvites_user ON public.leagueinvites(user_id);

COMMENT ON TABLE public.leagueinvites IS 'Tracks user invitations to leagues';

-- =====================================================================================
-- TEAM MANAGEMENT
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  team_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name varchar NOT NULL CHECK (char_length(team_name) >= 2),
  invite_code varchar UNIQUE,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON public.teams(team_name);
CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON public.teams(invite_code);

COMMENT ON TABLE public.teams IS 'Team entities that participate in leagues';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.teamleagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_teamleagues_team ON public.teamleagues(team_id);
CREATE INDEX IF NOT EXISTS idx_teamleagues_league ON public.teamleagues(league_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_league_name ON public.teamleagues(team_id, league_id);

COMMENT ON TABLE public.teamleagues IS 'Junction table for team participation in leagues';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.leaguemembers (
  league_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(team_id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_league UNIQUE (user_id, league_id)
);

CREATE INDEX IF NOT EXISTS idx_leaguemembers_user ON public.leaguemembers(user_id);
CREATE INDEX IF NOT EXISTS idx_leaguemembers_league ON public.leaguemembers(league_id);
CREATE INDEX IF NOT EXISTS idx_leaguemembers_team ON public.leaguemembers(team_id);
CREATE INDEX IF NOT EXISTS idx_leaguemembers_unassigned ON public.leaguemembers(league_id) WHERE team_id IS NULL;

COMMENT ON TABLE public.leaguemembers IS 'User membership in leagues with optional team assignment';
COMMENT ON COLUMN public.leaguemembers.team_id IS 'NULL indicates user is in allocation bucket awaiting team assignment';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.assignedrolesforleague (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(role_id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  CONSTRAINT unique_league_user_role UNIQUE (league_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_assignedrolesforleague_league ON public.assignedrolesforleague(league_id);
CREATE INDEX IF NOT EXISTS idx_assignedrolesforleague_user ON public.assignedrolesforleague(user_id);
CREATE INDEX IF NOT EXISTS idx_assignedrolesforleague_role ON public.assignedrolesforleague(role_id);

COMMENT ON TABLE public.assignedrolesforleague IS 'Multi-role assignments for users within specific leagues';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.teammembers (
  team_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(role_id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_team_user UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_teammembers_team ON public.teammembers(team_id);
CREATE INDEX IF NOT EXISTS idx_teammembers_user ON public.teammembers(user_id);

COMMENT ON TABLE public.teammembers IS 'Team membership with team-level role assignments';

-- =====================================================================================
-- WORKOUT SUBMISSIONS & VALIDATION
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.effortentry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_member_id uuid NOT NULL REFERENCES public.leaguemembers(league_member_id) ON DELETE CASCADE,
  date date NOT NULL,
  type varchar NOT NULL,
  workout_type varchar,
  duration integer CHECK (duration IS NULL OR duration > 0),
  distance numeric CHECK (distance IS NULL OR distance > 0),
  steps integer CHECK (steps IS NULL OR steps > 0),
  holes integer,
  rr_value numeric,
  status effort_status DEFAULT 'pending',
  proof_url varchar,
  notes text,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_effortentry_member ON public.effortentry(league_member_id);
CREATE INDEX IF NOT EXISTS idx_effortentry_date ON public.effortentry(date);
CREATE INDEX IF NOT EXISTS idx_effortentry_status ON public.effortentry(status);
CREATE INDEX IF NOT EXISTS idx_effortentry_member_date ON public.effortentry(league_member_id, date);

COMMENT ON TABLE public.effortentry IS 'Workout submission entries with proof and validation status';
COMMENT ON COLUMN public.effortentry.status IS 'Validation state: pending → captain review → approved/rejected';

-- =====================================================================================
-- CHALLENGES & SPECIAL EVENTS
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.specialchallenges (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description text,
  challenge_type varchar DEFAULT 'individual' CHECK (challenge_type IN ('individual', 'team', 'sub_team')),
  is_custom boolean DEFAULT false,
  payment_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  doc_url varchar,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT specialchallenges_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_specialchallenges_dates ON public.specialchallenges(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_specialchallenges_type ON public.specialchallenges(challenge_type);

COMMENT ON TABLE public.specialchallenges IS 'Master challenge templates (reusable across leagues)';
COMMENT ON COLUMN public.specialchallenges.challenge_type IS 'Challenge scope: individual, team, or sub_team';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.leagueschallenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES public.specialchallenges(challenge_id) ON DELETE SET NULL,
  name varchar,
  description text,
  challenge_type varchar DEFAULT 'individual' CHECK (challenge_type IN ('individual', 'team', 'sub_team')),
  total_points numeric NOT NULL DEFAULT 0,
  is_custom boolean DEFAULT false,
  payment_id uuid,
  doc_url varchar,
  start_date date,
  end_date date,
  status challenge_status DEFAULT 'active',
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_league_challenge UNIQUE (league_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_leagueschallenges_league ON public.leagueschallenges(league_id);
CREATE INDEX IF NOT EXISTS idx_leagueschallenges_status ON public.leagueschallenges(status);

COMMENT ON TABLE public.leagueschallenges IS 'Association between leagues and challenges';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.challenge_subteams (
  subteam_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_challenge_id uuid NOT NULL REFERENCES public.leagueschallenges(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  name varchar NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_subteams_challenge ON public.challenge_subteams(league_challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_subteams_team ON public.challenge_subteams(team_id);

COMMENT ON TABLE public.challenge_subteams IS 'Sub-teams for team-based challenges';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.challenge_subteam_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subteam_id uuid NOT NULL REFERENCES public.challenge_subteams(subteam_id) ON DELETE CASCADE,
  league_member_id uuid NOT NULL REFERENCES public.leaguemembers(league_member_id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_subteam_members_subteam ON public.challenge_subteam_members(subteam_id);
CREATE INDEX IF NOT EXISTS idx_challenge_subteam_members_member ON public.challenge_subteam_members(league_member_id);

COMMENT ON TABLE public.challenge_subteam_members IS 'Members of challenge sub-teams';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_challenge_id uuid NOT NULL REFERENCES public.leagueschallenges(id) ON DELETE CASCADE,
  league_member_id uuid NOT NULL REFERENCES public.leaguemembers(league_member_id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(team_id) ON DELETE SET NULL,
  sub_team_id uuid REFERENCES public.challenge_subteams(subteam_id) ON DELETE SET NULL,
  proof_url varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  awarded_points numeric,
  reviewed_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_challenge ON public.challenge_submissions(league_challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_member ON public.challenge_submissions(league_member_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_status ON public.challenge_submissions(status);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_team ON public.challenge_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_subteam ON public.challenge_submissions(sub_team_id);

COMMENT ON TABLE public.challenge_submissions IS 'Challenge submission records with approval status and optional custom points';
COMMENT ON COLUMN public.challenge_submissions.awarded_points IS 'Optional custom points awarded (overrides challenge total_points if set)';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.specialchallengeindividualuserscore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.specialchallenges(challenge_id) ON DELETE CASCADE,
  league_member_id uuid NOT NULL REFERENCES public.leaguemembers(league_member_id) ON DELETE CASCADE,
  league_id uuid REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  score numeric DEFAULT 0,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_challenge_member UNIQUE (challenge_id, league_member_id)
);

CREATE INDEX IF NOT EXISTS idx_specialchallenge_individual_challenge ON public.specialchallengeindividualuserscore(challenge_id);
CREATE INDEX IF NOT EXISTS idx_specialchallenge_individual_member ON public.specialchallengeindividualuserscore(league_member_id);
CREATE INDEX IF NOT EXISTS idx_specialchallenge_individual_score ON public.specialchallengeindividualuserscore(score DESC);

COMMENT ON TABLE public.specialchallengeindividualuserscore IS 'Individual player scores for special challenges';

-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.specialchallengeteamscore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.specialchallenges(challenge_id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(league_id) ON DELETE CASCADE,
  score numeric DEFAULT 0,
  created_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  modified_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  modified_date timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_challenge_team UNIQUE (challenge_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_specialchallenge_team_challenge ON public.specialchallengeteamscore(challenge_id);
CREATE INDEX IF NOT EXISTS idx_specialchallenge_team_team ON public.specialchallengeteamscore(team_id);
CREATE INDEX IF NOT EXISTS idx_specialchallenge_team_score ON public.specialchallengeteamscore(score DESC);

COMMENT ON TABLE public.specialchallengeteamscore IS 'Team aggregate scores for special challenges';

-- =====================================================================================
-- PAYMENTS & TRANSACTIONS
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.payments (
  payment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  league_id uuid REFERENCES public.leagues(league_id) ON DELETE SET NULL,
  purpose payment_purpose NOT NULL DEFAULT 'league_creation',
  razorpay_order_id varchar NOT NULL UNIQUE,
  razorpay_payment_id varchar UNIQUE,
  razorpay_signature varchar,
  status payment_status NOT NULL DEFAULT 'pending',
  base_amount numeric NOT NULL CHECK (base_amount >= 0),
  platform_fee numeric NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  gst_amount numeric NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  currency varchar NOT NULL DEFAULT 'INR',
  description text,
  receipt varchar,
  notes jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_league ON public.payments(league_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_purpose ON public.payments(purpose);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);

COMMENT ON TABLE public.payments IS 'Payment transaction records for league creation and subscriptions';
COMMENT ON COLUMN public.payments.razorpay_order_id IS 'Unique order ID from Razorpay';
COMMENT ON COLUMN public.payments.razorpay_payment_id IS 'Payment ID from Razorpay after successful payment';

-- =====================================================================================
-- TRIGGER FUNCTIONS
-- =====================================================================================

CREATE OR REPLACE FUNCTION update_modified_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_date = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================
-- TRIGGERS
-- =====================================================================================

CREATE TRIGGER users_modified_date BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER roles_modified_date BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER leagues_modified_date BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER teams_modified_date BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER activities_modified_date BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER leaguemembers_modified_date BEFORE UPDATE ON public.leaguemembers
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER teammembers_modified_date BEFORE UPDATE ON public.teammembers
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER effortentry_modified_date BEFORE UPDATE ON public.effortentry
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER specialchallenges_modified_date BEFORE UPDATE ON public.specialchallenges
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER specialchallengeindividualuserscore_modified_date BEFORE UPDATE ON public.specialchallengeindividualuserscore
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER specialchallengeteamscore_modified_date BEFORE UPDATE ON public.specialchallengeteamscore
  FOR EACH ROW EXECUTE FUNCTION update_modified_date();

CREATE TRIGGER pricing_updated_at BEFORE UPDATE ON public.pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leagueschallenges_updated_at BEFORE UPDATE ON public.leagueschallenges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================================
-- SEED DATA
-- =====================================================================================

INSERT INTO public.specialchallenges (challenge_id, name, challenge_type, start_date, end_date, created_date)
VALUES 
  (
    gen_random_uuid(),
    'Daily Steps Challenge',
    'individual',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Team Fitness Bingo',
    'team',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Unique Workout Day',
    'individual',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Sub-Team Leaderboard',
    'sub_team',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    CURRENT_TIMESTAMP
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.activity_categories (category_name, display_name, description, display_order)
VALUES 
  ('fitness', 'Fitness', 'Physical fitness and workout activities', 1),
  ('wellness', 'Wellness', 'Mental and spiritual wellness activities', 2),
  ('sports', 'Sports', 'Sports and competitive activities', 3),
  ('lifestyle', 'Lifestyle', 'Healthy lifestyle and nutrition habits', 4),
  ('discipline', 'Discipline', 'Time management and professional discipline', 5)
ON CONFLICT (category_name) DO NOTHING;

-- =====================================================================================
-- END OF SCHEMA
-- =====================================================================================
