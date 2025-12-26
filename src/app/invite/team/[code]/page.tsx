'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Sparkles,
  LogIn,
  UserPlus,
  UsersRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================================
// Types
// ============================================================================

interface TeamInfo {
  team_id: string;
  name: string;
  member_count: number;
  max_capacity: number;
  is_full: boolean;
}

interface LeagueInfo {
  league_id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
}

// ============================================================================
// Public Team Invite Page
// ============================================================================

export default function TeamInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = React.use(params);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [team, setTeam] = React.useState<TeamInfo | null>(null);
  const [league, setLeague] = React.useState<LeagueInfo | null>(null);
  const [canJoin, setCanJoin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState(false);
  const [alreadyMember, setAlreadyMember] = React.useState(false);

  // Fetch team info on mount
  React.useEffect(() => {
    const fetchTeamInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/invite/team/${code}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(data.error || 'Invalid team invite code');
          return;
        }

        setTeam(data.team);
        setLeague(data.league);
        setCanJoin(data.can_join);
      } catch (err) {
        setError('Failed to load invite details');
      } finally {
        setLoading(false);
      }
    };

    if (code) {
      fetchTeamInfo();
    }
  }, [code]);

  // Handle join action
  const handleJoin = React.useCallback(async () => {
    if (!session?.user) {
      // Store invite code and redirect to login
      localStorage.setItem('pendingTeamInviteCode', code);
      router.push(`/login?callbackUrl=/invite/team/${code}`);
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/invite/team/${code}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiresAuth) {
          localStorage.setItem('pendingTeamInviteCode', code);
          router.push(`/login?callbackUrl=/invite/team/${code}`);
          return;
        }
        throw new Error(data.error || 'Failed to join team');
      }

      if (data.alreadyMember) {
        setAlreadyMember(true);
      }
      setJoined(true);

      // Redirect to league after short delay
      setTimeout(() => {
        router.push(`/leagues/${data.leagueId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setJoining(false);
    }
  }, [session?.user, code, router]);

  // Auto-join if user returns after authentication with pending invite
  React.useEffect(() => {
    const pendingCode = localStorage.getItem('pendingTeamInviteCode');
    if (
      session?.user &&
      pendingCode === code &&
      team &&
      !joined &&
      !joining &&
      canJoin
    ) {
      // Clear the pending code and auto-join
      localStorage.removeItem('pendingTeamInviteCode');
      handleJoin();
    }
  }, [session, code, team, joined, joining, canJoin, handleJoin]);

  // Handle signup redirect
  const handleSignup = () => {
    localStorage.setItem('pendingTeamInviteCode', code);
    router.push(`/signup?callbackUrl=/invite/team/${code}`);
  };

  // Handle login redirect
  const handleLogin = () => {
    localStorage.setItem('pendingTeamInviteCode', code);
    router.push(`/login?callbackUrl=/invite/team/${code}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="size-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !team) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="size-8 text-destructive" />
            </div>
            <CardTitle>Invalid Invite</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              The team invite code may have expired or been entered incorrectly.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" asChild>
                <Link href="/">Go Home</Link>
              </Button>
              <Button asChild>
                <Link href="/leagues/join">Enter Code Manually</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (joined) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md overflow-hidden">
          {/* Animated gradient header */}
          <div className="p-8 text-center dark:text-white text-black relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute -top-6 -left-6 size-24 rounded-full bg-white/10 blur-lg animate-pulse" />
              <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-white/10 blur-lg animate-pulse delay-500" />
            </div>

            <div className="relative">
              <div className="size-20 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 ring-4 ring-white/30">
                <CheckCircle2 className="size-10 dark:text-white text-black animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {alreadyMember ? 'Welcome Back!' : "You're In!"}
              </h2>
              <p className="dark:text-white text-black">
                {alreadyMember
                  ? `You're already part of the team`
                  : `Successfully joined ${team?.name}`}
              </p>
            </div>
          </div>

          <CardContent className="p-6 text-center">
            <div className="mb-4">
              <Badge variant="outline" className="mb-2">
                <UsersRound className="size-3 mr-1" />
                {team?.name}
              </Badge>
              <h3 className="text-xl font-semibold">{league?.name}</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              {alreadyMember
                ? 'Taking you back to your league...'
                : 'Get ready to compete, stay fit, and win together!'}
            </p>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-muted/50 border">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Redirecting to league...
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main invite page
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        {/* Header with gradient */}
        <div className="p-6 text-center dark:text-white text-black">
          <div className="size-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <UsersRound className="size-8" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Team Invite!</h1>
          <p className="dark:text-white text-black">
            Join the team and compete together
          </p>
        </div>

        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Badge variant="secondary">
              <UsersRound className="size-3 mr-1" />
              {team?.name}
            </Badge>
          </div>
          <CardTitle className="text-xl">{league?.name}</CardTitle>
          {league?.description && (
            <CardDescription className="line-clamp-2">
              {league.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Team and league stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Users className="size-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">
                {team?.member_count}
              </p>
              <p className="text-xs text-muted-foreground">Members</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Calendar className="size-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">
                {league?.start_date
                  ? new Date(league.start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '-'}
              </p>
              <p className="text-xs text-muted-foreground">Starts</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Clock className="size-5 mx-auto mb-1 text-primary" />
              <Badge
                variant={
                  league?.status === 'active'
                    ? 'default'
                    : league?.status === 'launched'
                    ? 'outline'
                    : 'secondary'
                }
                className="text-xs"
              >
                {league?.status}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Status</p>
            </div>
          </div>

          {/* Capacity warning */}
          {team?.is_full && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>This team is full and not accepting new members.</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          {sessionStatus === 'loading' ? (
            <Button disabled className="w-full">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading...
            </Button>
          ) : session?.user ? (
            // Logged in user
            <Button
              onClick={handleJoin}
              disabled={joining || team?.is_full || !canJoin}
              className="w-full"
              size="lg"
            >
              {joining ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Joining...
                </>
              ) : team?.is_full ? (
                'Team is Full'
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Join Team
                </>
              )}
            </Button>
          ) : (
            // Not logged in
            <div className="space-y-3">
              <Button onClick={handleSignup} className="w-full" size="lg">
                <UserPlus className="size-4 mr-2" />
                Sign Up to Join
              </Button>
              <Button
                onClick={handleLogin}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <LogIn className="size-4 mr-2" />
                Already have an account? Log In
              </Button>
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-center text-muted-foreground">
            By joining, you agree to participate fairly and follow the league
            rules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
