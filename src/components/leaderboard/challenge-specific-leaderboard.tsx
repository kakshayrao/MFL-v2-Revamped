/**
 * Challenge-Specific Leaderboard Component
 * Shows rankings specific to a selected challenge based on its type
 */
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Challenge {
  id: string;
  name: string;
  challenge_type: 'individual' | 'team' | 'sub_team';
  total_points: number;
}

interface ChallengeScore {
  id: string;
  name: string;
  score: number;
  rank: number;
  teamName?: string; // For sub-team challenges, shows the parent team
}

interface ChallengeSpecificLeaderboardProps {
  leagueId: string;
}

// ============================================================================
// Rank Badge Component
// ============================================================================

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
        <Trophy className="size-4 text-yellow-600" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-800">
        <Medal className="size-4 text-gray-500" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center size-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
        <Medal className="size-4 text-orange-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center size-8 rounded-full bg-muted">
      <span className="text-sm font-medium text-muted-foreground">{rank}</span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChallengeSpecificLeaderboard({ leagueId }: ChallengeSpecificLeaderboardProps) {
  const [challenges, setChallenges] = React.useState<Challenge[]>([]);
  const [selectedChallengeId, setSelectedChallengeId] = React.useState<string>('');
  const [scores, setScores] = React.useState<ChallengeScore[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId);

  // Fetch challenges
  React.useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await fetch(`/api/leagues/${leagueId}/challenges`);
        const json = await res.json();
        if (json.success && json.data?.active) {
          setChallenges(json.data.active);
        }
      } catch (err) {
        console.error('Failed to fetch challenges:', err);
      }
    };
    fetchChallenges();
  }, [leagueId]);

  // Fetch scores for selected challenge
  React.useEffect(() => {
    if (!selectedChallengeId) {
      setScores([]);
      return;
    }

    const fetchScores = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/leagues/${leagueId}/challenges/${selectedChallengeId}/leaderboard`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to fetch scores');
        }
        setScores(json.data || []);
      } catch (err) {
        console.error('Failed to fetch challenge scores:', err);
        setError(err instanceof Error ? err.message : 'Failed to load scores');
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [leagueId, selectedChallengeId]);

  const getChallengeTypeLabel = (type: string) => {
    switch (type) {
      case 'individual':
        return 'Individual';
      case 'team':
        return 'Team-wise';
      case 'sub_team':
        return 'Sub-team';
      default:
        return type;
    }
  };

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'team':
      case 'sub_team':
        return <Users className="size-4" />;
      case 'individual':
      default:
        return <User className="size-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5" />
          Challenges
        </CardTitle>
        <CardDescription>
          {selectedChallenge
            ? `${getChallengeTypeLabel(selectedChallenge.challenge_type)} scores per challenge`
            : 'Select a challenge to view rankings'}
        </CardDescription>
        {selectedChallenge && (
          <p className="text-sm text-muted-foreground">
            All points are added to the Team leaderboard above
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedChallengeId} onValueChange={setSelectedChallengeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select challenge..." />
          </SelectTrigger>
          <SelectContent>
            {challenges.map((challenge) => (
              <SelectItem key={challenge.id} value={challenge.id}>
                <div className="flex items-center gap-2">
                  {getChallengeIcon(challenge.challenge_type)}
                  <span>{challenge.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {challenge.total_points} pts
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!selectedChallengeId && challenges.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No challenges yet.
          </div>
        )}

        {!selectedChallengeId && challenges.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Select a challenge to view rankings
          </div>
        )}

        {selectedChallengeId && loading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading scores...
          </div>
        )}

        {selectedChallengeId && error && (
          <div className="text-center py-12 text-destructive">
            {error}
          </div>
        )}

        {selectedChallengeId && !loading && !error && scores.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No submissions yet for this challenge.
          </div>
        )}

        {selectedChallengeId && !loading && !error && scores.length > 0 && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>
                    {selectedChallenge?.challenge_type === 'individual'
                      ? 'Player'
                      : selectedChallenge?.challenge_type === 'sub_team'
                        ? 'Sub-team'
                        : 'Team'}
                  </TableHead>
                  {selectedChallenge?.challenge_type === 'sub_team' && (
                    <TableHead>Team</TableHead>
                  )}
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((score) => (
                  <TableRow
                    key={score.id}
                    className={cn(score.rank <= 3 && 'bg-muted/30')}
                  >
                    <TableCell>
                      <RankBadge rank={score.rank} />
                    </TableCell>
                    <TableCell className="font-medium">{score.name}</TableCell>
                    {selectedChallenge?.challenge_type === 'sub_team' && (
                      <TableCell className="text-muted-foreground">
                        {score.teamName || 'Unknown Team'}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <span className="text-lg font-bold text-primary">
                        {score.score}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
