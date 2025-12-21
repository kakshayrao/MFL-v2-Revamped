-- Add team_id and sub_team_id to challenge_submissions to track team/individual/sub_team submissions
-- This allows proper aggregation in leaderboards based on challenge type
-- Teams are verified against teamleagues to ensure they belong to the league

ALTER TABLE public.challenge_submissions
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(team_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_team_id uuid REFERENCES public.challenge_subteams(subteam_id) ON DELETE SET NULL;

-- Create indexes for efficient filtering by team/sub_team
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_team ON public.challenge_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_subteam ON public.challenge_submissions(sub_team_id);

-- Add constraint check to ensure only one team identifier is set based on challenge type
-- (This is enforced at application level; schema allows flexibility)

COMMENT ON COLUMN public.challenge_submissions.team_id IS 'Team ID for team-type challenges; verified against teamleagues for the league; NULL for individual/sub_team';
COMMENT ON COLUMN public.challenge_submissions.sub_team_id IS 'Sub-team ID for sub_team-type challenges; NULL for individual/team';
