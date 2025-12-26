/**
 * Admin Stats Service
 * Handles dashboard and revenue statistics
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';
import type { DashboardStats, RevenueStats } from '@/types/admin';

// ============================================================================
// Chart Data Types
// ============================================================================

export interface RevenueChartDataPoint {
  date: string;
  revenue: number;
  transactions: number;
}

export interface RevenueChartData {
  data: RevenueChartDataPoint[];
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = getSupabaseServiceRole();
    // Current month start
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ===== Total Users =====
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Users last month
    const { count: usersLastMonth } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .lte('created_date', endOfLastMonth.toISOString());

    const totalUsersChange = usersLastMonth
      ? (((totalUsers || 0) - usersLastMonth) / usersLastMonth) * 100
      : 0;

    // ===== Active Leagues =====
    const { count: activeLeagues } = await supabase
      .from('leagues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_active', true);

    // Active leagues last month
    const { count: activeLeaguesLastMonth } = await supabase
      .from('leagues')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_active', true)
      .lte('created_date', endOfLastMonth.toISOString());

    const activeLeaguesChange = activeLeaguesLastMonth
      ? (((activeLeagues || 0) - activeLeaguesLastMonth) / activeLeaguesLastMonth) * 100
      : 0;

    // ===== Total Submissions (this month) =====
    const { count: totalSubmissions } = await supabase
      .from('effortentry')
      .select('*', { count: 'exact', head: true })
      .gte('created_date', startOfMonth.toISOString());

    // Submissions last month
    const { count: submissionsLastMonth } = await supabase
      .from('effortentry')
      .select('*', { count: 'exact', head: true })
      .gte('created_date', startOfLastMonth.toISOString())
      .lte('created_date', endOfLastMonth.toISOString());

    const submissionsChange = submissionsLastMonth
      ? (((totalSubmissions || 0) - submissionsLastMonth) / submissionsLastMonth) * 100
      : 0;

    // ===== Total Revenue (this month) =====
    const { data: revenueData } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString());

    const totalRevenue = (revenueData || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    // Revenue last month
    const { data: revenueLastMonthData } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', startOfLastMonth.toISOString())
      .lte('created_at', endOfLastMonth.toISOString());

    const revenueLastMonth = (revenueLastMonthData || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    const revenueChange = revenueLastMonth
      ? ((totalRevenue - revenueLastMonth) / revenueLastMonth) * 100
      : 0;

    return {
      totalUsers: totalUsers || 0,
      totalUsersChange: Math.round(totalUsersChange * 10) / 10,
      activeLeagues: activeLeagues || 0,
      activeLeaguesChange: Math.round(activeLeaguesChange * 10) / 10,
      totalSubmissions: totalSubmissions || 0,
      submissionsChange: Math.round(submissionsChange * 10) / 10,
      totalRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
    };
  } catch (err) {
    console.error('Error in getDashboardStats:', err);
    return {
      totalUsers: 0,
      totalUsersChange: 0,
      activeLeagues: 0,
      activeLeaguesChange: 0,
      totalSubmissions: 0,
      submissionsChange: 0,
      totalRevenue: 0,
      revenueChange: 0,
    };
  }
}

/**
 * Get revenue statistics
 */
export async function getRevenueStats(): Promise<RevenueStats> {
  try {
    const supabase = getSupabaseServiceRole();

    // Current month start
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ===== Total Revenue (all time) =====
    const { data: totalRevenueData } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed');

    const totalRevenue = (totalRevenueData || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    // Total revenue up to last month
    const { data: totalRevenueLastMonthData } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed')
      .lte('created_at', endOfLastMonth.toISOString());

    const totalRevenueLastMonth = (totalRevenueLastMonthData || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    const totalRevenueChange = totalRevenueLastMonth
      ? ((totalRevenue - totalRevenueLastMonth) / totalRevenueLastMonth) * 100
      : 0;

    // ===== Monthly Revenue =====
    const { data: monthlyRevenueData } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString());

    const monthlyRevenue = (monthlyRevenueData || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    // Revenue last month
    const { data: lastMonthRevenueData } = await supabase
      .from('payments')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', startOfLastMonth.toISOString())
      .lte('created_at', endOfLastMonth.toISOString());

    const lastMonthRevenue = (lastMonthRevenueData || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );

    const monthlyRevenueChange = lastMonthRevenue
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // ===== Total Transactions (this month) =====
    const { count: totalTransactions } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString());

    // Transactions last month
    const { count: transactionsLastMonth } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', startOfLastMonth.toISOString())
      .lte('created_at', endOfLastMonth.toISOString());

    const transactionsChange = transactionsLastMonth
      ? (((totalTransactions || 0) - transactionsLastMonth) / transactionsLastMonth) * 100
      : 0;

    // ===== Average Transaction =====
    const avgTransaction =
      totalTransactions && totalTransactions > 0
        ? monthlyRevenue / totalTransactions
        : 0;

    const avgTransactionLastMonth =
      transactionsLastMonth && transactionsLastMonth > 0
        ? lastMonthRevenue / transactionsLastMonth
        : 0;

    const avgTransactionChange = avgTransactionLastMonth
      ? ((avgTransaction - avgTransactionLastMonth) / avgTransactionLastMonth) * 100
      : 0;

    return {
      totalRevenue,
      totalRevenueChange: Math.round(totalRevenueChange * 10) / 10,
      monthlyRevenue,
      monthlyRevenueChange: Math.round(monthlyRevenueChange * 10) / 10,
      totalTransactions: totalTransactions || 0,
      transactionsChange: Math.round(transactionsChange * 10) / 10,
      avgTransaction: Math.round(avgTransaction * 100) / 100,
      avgTransactionChange: Math.round(avgTransactionChange * 10) / 10,
    };
  } catch (err) {
    console.error('Error in getFinancialStats:', err);
    return {
      totalRevenue: 0,
      totalRevenueChange: 0,
      monthlyRevenue: 0,
      monthlyRevenueChange: 0,
      totalTransactions: 0,
      transactionsChange: 0,
      avgTransaction: 0,
      avgTransactionChange: 0,
    };
  }
}

/**
 * Get revenue chart data for the last N days
 */
export async function getRevenueChartData(days: number = 90): Promise<RevenueChartData> {
  try {
    const supabase = getSupabaseServiceRole();

    // Calculate start date
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    // Fetch all payments in the date range
    const { data: payments, error } = await supabase
      .from('payments')
      .select('total_amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching payments for chart:', error);
      return { data: [] };
    }

    // Group payments by date
    const dailyData: Map<string, { revenue: number; transactions: number }> = new Map();

    // Initialize all dates with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData.set(dateStr, { revenue: 0, transactions: 0 });
    }

    // Aggregate payment data by date
    (payments || []).forEach((payment) => {
      const dateStr = new Date(payment.created_at).toISOString().split('T')[0];
      const existing = dailyData.get(dateStr) || { revenue: 0, transactions: 0 };
      dailyData.set(dateStr, {
        revenue: existing.revenue + (Number(payment.total_amount) || 0),
        transactions: existing.transactions + 1,
      });
    });

    // Convert to array sorted by date
    const chartData: RevenueChartDataPoint[] = Array.from(dailyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, transactions }]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100,
        transactions,
      }));

    return { data: chartData };
  } catch (err) {
    console.error('Error in getRevenueChartData:', err);
    return { data: [] };
  }
}
