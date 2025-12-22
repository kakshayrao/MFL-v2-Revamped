-- Allow duplicate team names across different leagues
-- Remove the UNIQUE constraint on team_name to allow same team name in different leagues

-- Drop the UNIQUE constraint on team_name
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_team_name_key;

-- Add a comment to clarify the design
COMMENT ON COLUMN public.teams.team_name IS 'Team name - can be reused across different leagues via teamleagues junction';

-- Create a unique index on (team_name, league) at the application level through teamleagues
-- This ensures the same team_name cannot be used twice in the same league
-- Note: This is enforced at application level since teams can be in multiple leagues
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_league_name ON public.teamleagues(team_id, league_id);
