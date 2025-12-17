"use client";


import * as React from "react";

import { SectionCards } from "@/components/dashboard/section-cards";
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive";
import { DataTable } from "@/components/dashboard/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { useAdminStats } from "@/hooks/admin";

import data from "./data/data.json";

// ============================================================================
// Default Stats (shown when data is unavailable or on error)
// ============================================================================

const defaultStats = [
  {
    title: "Total Users",
    value: "0",
    change: 0,
    changeLabel: "No data available",
    description: "Active users in the last 30 days",
  },
  {
    title: "Active Leagues",
    value: "0",
    change: 0,
    changeLabel: "No data available",
    description: "Leagues currently in progress",
  },
  {
    title: "Submissions",
    value: "0",
    change: 0,
    changeLabel: "No data available",
    description: "This month's submissions",
  },
  {
    title: "Revenue",
    value: "₹0",
    change: 0,
    changeLabel: "No data available",
    description: "This month's revenue",
  },
];

// ============================================================================
// Loading Skeleton for Stats
// ============================================================================

function StatsSkeleton() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="@container/card">
          <CardHeader>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20 mt-2" />
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Safe number formatter
// ============================================================================

function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === "number" && !isNaN(value)) {
    return value;
  }
  return defaultValue;
}

function formatCurrency(value: unknown): string {
  const num = safeNumber(value, 0);
  return `₹${num.toLocaleString()}`;
}

function formatNumber(value: unknown): string {
  const num = safeNumber(value, 0);
  return num.toLocaleString();
}

// ============================================================================
// Admin Dashboard Page
// ============================================================================

/**
 * AdminDashboardPage - Main admin dashboard page.
 *
 * Features:
 * - Overview stat cards (users, leagues, submissions, revenue)
 * - Interactive area chart for visitor analytics
 * - Data table with drag-and-drop, sorting, filtering
 *
 * Layout:
 * - Container with responsive container queries (@container)
 * - Vertical stack with consistent gap
 */
export default function AdminDashboardPage() {
  const { stats, isLoading, error } = useAdminStats();

  // Transform stats to the format expected by SectionCards
  // On error or no valid data, use default stats with 0 values
  const sectionStats = React.useMemo(() => {
    // If no stats or error, return defaults
    if (!stats || error) {
      return defaultStats;
    }

    // Safely extract values with fallbacks
    const totalUsers = safeNumber(stats.totalUsers);
    const totalUsersChange = safeNumber(stats.totalUsersChange);
    const activeLeagues = safeNumber(stats.activeLeagues);
    const activeLeaguesChange = safeNumber(stats.activeLeaguesChange);
    const totalSubmissions = safeNumber(stats.totalSubmissions);
    const submissionsChange = safeNumber(stats.submissionsChange);
    const totalRevenue = safeNumber(stats.totalRevenue);
    const revenueChange = safeNumber(stats.revenueChange);

    return [
      {
        title: "Total Users",
        value: formatNumber(totalUsers),
        change: totalUsersChange,
        changeLabel: totalUsersChange >= 0 ? "Trending up this month" : "Down from last month",
        description: "Total active users",
      },
      {
        title: "Active Leagues",
        value: formatNumber(activeLeagues),
        change: activeLeaguesChange,
        changeLabel: activeLeaguesChange >= 0 ? "Growing" : "Slightly down",
        description: "Leagues currently in progress",
      },
      {
        title: "Submissions",
        value: formatNumber(totalSubmissions),
        change: submissionsChange,
        changeLabel: submissionsChange >= 0 ? "Strong activity" : "Stable",
        description: "This month's submissions",
      },
      {
        title: "Revenue",
        value: formatCurrency(totalRevenue),
        change: revenueChange,
        changeLabel: revenueChange >= 0 ? "Steady growth" : "Revenue dip",
        description: "This month's revenue",
      },
    ];
  }, [stats, error]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-4 lg:gap-6">
      {/* Section Cards - Overview Stats */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <SectionCards stats={sectionStats} />
      )}

      {/* Interactive Chart */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>

      {/* Data Table */}
      <DataTable data={data} />
    </div>
  );
}
