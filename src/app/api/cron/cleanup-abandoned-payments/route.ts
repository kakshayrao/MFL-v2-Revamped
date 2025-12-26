/**
 * Cron job to cleanup abandoned payment attempts
 * Deletes payment records that are older than 48 hours and still in pending status
 * This prevents database pollution from users who abandoned checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // Calculate cutoff time (48 hours ago)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 48);

    // Delete pending payments older than 48 hours where no league was created
    const { data: deletedPayments, error } = await supabase
      .from('payments')
      .delete()
      .is('league_id', null)
      .eq('status', 'pending')
      .lt('created_date', cutoffDate.toISOString())
      .select();

    if (error) {
      console.error('Error cleaning up abandoned payments:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup abandoned payments', details: error.message },
        { status: 500 }
      );
    }

    const cleanedCount = deletedPayments?.length || 0;

    console.log(`[CLEANUP] Deleted ${cleanedCount} abandoned payment records`);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${cleanedCount} abandoned payment(s)`,
      cleanedCount,
    });
  } catch (err: any) {
    console.error('Unexpected error during payment cleanup:', err);
    return NextResponse.json(
      { error: err.message || 'Unexpected error during cleanup' },
      { status: 500 }
    );
  }
}
