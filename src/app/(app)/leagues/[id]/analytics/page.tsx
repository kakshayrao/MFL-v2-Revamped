'use client';

import React, { use, useEffect, useState } from 'react';
import { ChevronLeft, Download, TrendingUp, Users, Target, AlertTriangle, Activity, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useRole } from '@/contexts/role-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AnalyticsData {
  leagueHealth: {
    totalMembers: number;
    activeMembers: number;
    activeMembersPercent: number;
    inactiveMembersPercent: number;
    totalTeams: number;
    daysCompleted: number;
    totalDays: number;
    leagueProgress: number;
  };
  participation: {
    dailyData: Array<{ date: string; participationRate: number; submissions: number }>;
    avgDailySubmissions: number;
  };
  topPerformers: Array<{ memberId: string; username: string; submissions: number }>;
  bottomPerformers: Array<{ memberId: string; username: string; submissions: number }>;
  teamPerformance: Array<{ teamId: string; teamName: string; size: number; rawPoints: number; avgPointsPerPlayer: number }>;
  restDayAnalytics: { totalUsed: number; avgPerMember: number };
  alerts: Array<{ type: string; message: string; teams?: string[]; users?: string[] }>;
}

interface PageSkeleton {
  [key: string]: any;
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function LeagueAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isHost } = useRole();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/leagues/${id}/analytics`, {
          next: { revalidate: 600 }, // Revalidate every 10 minutes
        });
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const result = await response.json();
        if (result.success) {
          setData(result.data);
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchAnalytics();
  }, [id]);

  if (loading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6 py-6">
        <Link href={`/leagues/${id}`}>
          <Button variant="ghost" size="sm" className="w-fit">
            <ChevronLeft className="size-4 mr-2" />
            Back to League
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) return <AnalyticsSkeleton />;

  const handleExport = () => {
    const csv = generateCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `league-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/leagues/${id}`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">League Analytics</h1>
            <p className="text-sm text-muted-foreground">Comprehensive performance & engagement insights</p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()} • Cached for 10 minutes
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleExport} variant="outline" size="sm">
          <Download className="size-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Alerts Section */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, idx) => (
            <Alert key={idx} variant={alert.type === 'warning' ? 'default' : 'destructive'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {alert.message}
                {alert.teams && alert.teams.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {alert.teams.slice(0, 3).map((team) => (
                      <Badge key={team} variant="secondary" className="text-xs">
                        {team}
                      </Badge>
                    ))}
                  </div>
                )}
                {alert.users && alert.users.length > 0 && (
                  <div className="mt-2 text-sm">{alert.users.join(', ')}</div>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* 1. League Health Overview */}
      <div>
        <h2 className="text-lg font-semibold mb-4">🏥 League Health Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{data.leagueHealth.totalMembers}</div>
                <p className="text-sm text-muted-foreground mt-2">Total Members</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{data.leagueHealth.activeMembersPercent}%</div>
                <p className="text-sm text-muted-foreground mt-2">Active Members</p>
                <p className="text-xs text-muted-foreground">({data.leagueHealth.activeMembers} of {data.leagueHealth.totalMembers})</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{data.leagueHealth.inactiveMembersPercent}%</div>
                <p className="text-sm text-muted-foreground mt-2">Inactive Members</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{data.leagueHealth.totalTeams}</div>
                <p className="text-sm text-muted-foreground mt-2">Total Teams</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="pt-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">League Progress</p>
                  <span className="text-2xl font-bold">{data.leagueHealth.leagueProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${data.leagueHealth.leagueProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {data.leagueHealth.daysCompleted} of {data.leagueHealth.totalDays} days
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. Participation & Consistency */}
      <div>
        <h2 className="text-lg font-semibold mb-4">📊 Participation & Consistency</h2>
        <Card>
          <CardHeader>
            <CardTitle>Daily Participation Trend</CardTitle>
            <CardDescription>Submissions per day and participation rate</CardDescription>
          </CardHeader>
          <CardContent>
            {data.participation.dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.participation.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" style={{ fontSize: '12px' }} />
                  <YAxis yAxisId="left" style={{ fontSize: '12px' }} />
                  <YAxis yAxisId="right" orientation="right" style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="submissions" stroke="#3b82f6" name="Submissions" />
                  <Line yAxisId="right" type="monotone" dataKey="participationRate" stroke="#10b981" name="Participation %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Avg Daily Submissions: <span className="font-semibold">{data.participation.avgDailySubmissions}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Team Performance */}
      <div>
        <h2 className="text-lg font-semibold mb-4">🏆 Team Performance</h2>
        <Card>
          <CardHeader>
            <CardTitle>Team Leaderboard</CardTitle>
            <CardDescription>Total points and average per player</CardDescription>
          </CardHeader>
          <CardContent>
            {data.teamPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.teamPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="teamName" style={{ fontSize: '12px' }} />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rawPoints" fill="#3b82f6" name="Total Points" />
                  <Bar dataKey="avgPointsPerPlayer" fill="#10b981" name="Avg per Player" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No teams available</p>
            )}
          </CardContent>
        </Card>

        {/* Team Details Table */}
        <div className="mt-4 grid grid-cols-1 gap-2">
          {data.teamPerformance.map((team) => (
            <Card key={team.teamId} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{team.teamName}</p>
                  <p className="text-sm text-muted-foreground">{team.size} members</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">{team.rawPoints}</p>
                  <p className="text-xs text-muted-foreground">{team.avgPointsPerPlayer.toFixed(1)} avg/player</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">⭐ Top Performers</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {data.topPerformers.slice(0, 10).map((user, idx) => (
                  <div key={user.memberId} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{idx + 1}</Badge>
                      <p className="font-medium">{user.username}</p>
                    </div>
                    <p className="font-semibold text-green-600">{user.submissions}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Performers */}
        <div>
          <h2 className="text-lg font-semibold mb-4">📉 Bottom Performers</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                {data.bottomPerformers.slice(0, 10).map((user, idx) => (
                  <div key={user.memberId} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        {data.topPerformers.length - idx}
                      </Badge>
                      <p className="font-medium">{user.username}</p>
                    </div>
                    <p className="font-semibold text-red-600">{user.submissions}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5. Rest Day Analytics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">😴 Rest Day Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{data.restDayAnalytics.totalUsed}</div>
                <p className="text-sm text-muted-foreground mt-2">Total Rest Days Used</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{data.restDayAnalytics.avgPerMember}</div>
                <p className="text-sm text-muted-foreground mt-2">Avg Per Member</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// CSV Export Helper
function generateCSV(data: AnalyticsData): string {
  const rows: string[] = [];

  rows.push('LEAGUE ANALYTICS REPORT');
  rows.push(new Date().toISOString());
  rows.push('');

  rows.push('LEAGUE HEALTH OVERVIEW');
  rows.push('Metric,Value');
  rows.push(`Total Members,${data.leagueHealth.totalMembers}`);
  rows.push(`Active Members,${data.leagueHealth.activeMembers} (${data.leagueHealth.activeMembersPercent}%)`);
  rows.push(`Total Teams,${data.leagueHealth.totalTeams}`);
  rows.push(`League Progress,${data.leagueHealth.leagueProgress}%`);
  rows.push('');

  rows.push('TOP PERFORMERS');
  rows.push('Rank,Username,Submissions');
  data.topPerformers.forEach((user, idx) => {
    rows.push(`${idx + 1},${user.username},${user.submissions}`);
  });
  rows.push('');

  rows.push('TEAM PERFORMANCE');
  rows.push('Team,Size,Total Points,Avg Per Player');
  data.teamPerformance.forEach((team) => {
    rows.push(`${team.teamName},${team.size},${team.rawPoints},${team.avgPointsPerPlayer.toFixed(1)}`);
  });

  return rows.join('\n');
}
