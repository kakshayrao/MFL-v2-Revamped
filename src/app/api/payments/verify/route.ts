/**
 * POST /api/payments/verify
 * Verifies Razorpay payment signature and updates payment status
 * Also updates the league status to 'launched' after successful payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { updatePaymentStatus } from '@/lib/services/payments';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentId, signature } = await req.json();

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = verifyPaymentSignature(orderId, paymentId, signature);
    if (!isValid) {
      // Update payment as failed
      await updatePaymentStatus(orderId, paymentId, signature, 'failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Get payment record to retrieve league data
    const supabase = getSupabaseServiceRole();
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single();

    if (fetchError || !paymentRecord) {
      console.error('Failed to fetch payment record:', fetchError);
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // Create league if league data exists in notes
    let leagueId = paymentRecord.league_id;
    
    if (!leagueId && paymentRecord.notes?.leagueData) {
      const leagueData = paymentRecord.notes.leagueData;
      
      // Import createLeague function
      const { createLeague } = await import('@/lib/services/leagues');
      
      // Create the league now that payment is successful
      const league = await createLeague(leagueData.created_by, {
        league_name: leagueData.league_name,
        description: leagueData.description,
        start_date: leagueData.start_date,
        end_date: leagueData.end_date,
        tier_id: leagueData.tier_id,
        num_teams: leagueData.num_teams,
        max_participants: leagueData.max_participants,
        rest_days: leagueData.rest_days,
        is_public: leagueData.is_public,
        is_exclusive: leagueData.is_exclusive,
      });

      if (!league) {
        console.error('Failed to create league after payment');
        return NextResponse.json(
          { error: 'Payment successful but league creation failed. Please contact support.' },
          { status: 500 }
        );
      }

      leagueId = league.league_id;

      // Update payment record with league_id
      await supabase
        .from('payments')
        .update({ league_id: leagueId })
        .eq('payment_id', paymentRecord.payment_id);

      // Determine initial league status based on start date
      const startDate = new Date(leagueData.start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      const initialStatus = startDate > today ? 'scheduled' : 'active';

      // Update league with tier snapshot and status
      await supabase
        .from('leagues')
        .update({
          tier_snapshot: leagueData.tier_snapshot,
          status: initialStatus,
          modified_date: new Date().toISOString(),
        })
        .eq('league_id', leagueId);
    }

    // Update payment status to completed
    const payment = await updatePaymentStatus(orderId, paymentId, signature, 'completed');

    return NextResponse.json({
      success: true,
      payment: {
        payment_id: payment.payment_id,
        status: payment.status,
        league_id: leagueId,
      },
    });
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return NextResponse.json(
      { error: err.message || 'Payment verification failed' },
      { status: 500 }
    );
  }
}
