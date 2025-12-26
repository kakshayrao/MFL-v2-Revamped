/**
 * POST /api/payments/order
 * Creates a Razorpay order for league payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/razorpay';
import { createPayment } from '@/lib/services/payments';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const { leagueData } = await req.json();
    if (!leagueData) {
      return NextResponse.json({ error: 'League data is required' }, { status: 400 });
    }

    // Validate required league data fields
    if (!leagueData.tier_id || !leagueData.league_name || !leagueData.start_date || !leagueData.end_date) {
      return NextResponse.json({ error: 'Missing required league data' }, { status: 400 });
    }

    // Calculate pricing from tier configuration
    const startDate = new Date(leagueData.start_date);
    const endDate = new Date(leagueData.end_date);
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const estimatedParticipants = leagueData.max_participants || (leagueData.num_teams || 4) * 5;

    // Get tier snapshot with pricing
    const { TierPricingService } = await import('@/lib/services/tier-pricing');
    const tierSnapshot = await TierPricingService.createTierSnapshot(
      leagueData.tier_id,
      durationDays,
      estimatedParticipants
    );

    if (!tierSnapshot || !tierSnapshot.pricing || !tierSnapshot.pricing.total) {
      return NextResponse.json(
        { error: 'Failed to calculate pricing for tier' },
        { status: 400 }
      );
    }

    const total = tierSnapshot.pricing.total;

    // Create Razorpay order
    const order = await createOrder(total, `league_${Date.now()}`);

    // Save payment record with league data in notes
    await createPayment({
      user_id: userId,
      league_id: null, // League doesn't exist yet
      razorpay_order_id: order.id,
      base_amount: tierSnapshot.pricing.subtotal || 0,
      platform_fee: 0,
      gst_amount: tierSnapshot.pricing.gst_amount || 0,
      total_amount: total,
      purpose: 'league_creation',
      description: `Payment for ${leagueData.league_name}`,
      notes: {
        // Store all league data for creation after payment
        leagueData: {
          ...leagueData,
          tier_snapshot: tierSnapshot,
          created_by: userId
        },
        tierId: leagueData.tier_id,
        tierName: tierSnapshot.tier_name,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error('Error creating order:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
