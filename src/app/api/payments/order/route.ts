/**
 * POST /api/payments/order
 * Creates a Razorpay order for league payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '@/lib/razorpay';
import { createPayment } from '@/lib/services/payments';
import { getPricing, getPricingById } from '@/lib/services/pricing';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { leagueId, tierId, durationDays, totalPlayers } = await req.json();
    if (!leagueId) {
      return NextResponse.json({ error: 'League ID is required' }, { status: 400 });
    }

    // If tierId is provided, it maps to pricing.id
    const pricing = tierId ? await getPricingById(String(tierId)) : await getPricing();
    if (!pricing) {
      return NextResponse.json(
        { error: tierId ? 'Invalid tier pricing' : 'Pricing not configured' },
        { status: tierId ? 400 : 500 }
      );
    }

    let duration = Number(durationDays) || 0;
    let capacity = Number(totalPlayers) || 0;

    if (tierId && (!duration || !capacity)) {
      const supabase = getSupabaseServiceRole();
      const { data: tierRow } = await supabase
        .from('league_tiers')
        .select('league_capacity, league_days, duration_days, permitted_days, league_days_permitted')
        .eq('tier_id', tierId)
        .maybeSingle();

      if (!duration) {
        duration = Number(
          tierRow?.duration_days ?? tierRow?.league_days ?? tierRow?.permitted_days ?? tierRow?.league_days_permitted
        );
      }
      if (!capacity) {
        capacity = Number(tierRow?.league_capacity);
      }
    }

    const safeBase = Number(pricing.base_price) || 0;
    const safePlatform = Number(pricing.platform_fee) || 0;
    const perDayRate = pricing.per_day_rate != null ? Number(pricing.per_day_rate) : 0;
    const perParticipantRate = pricing.per_participant_rate != null ? Number(pricing.per_participant_rate) : 0;
    const totalDays = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const totalPlayersCount = Number.isFinite(capacity) && capacity > 0 ? capacity : 0;

    const perDayTotal = perDayRate * totalDays;
    const perParticipantTotal = perParticipantRate * totalPlayersCount;
    const subtotal = safeBase + safePlatform + perDayTotal + perParticipantTotal;
    const gstPct = Number(pricing.gst_percentage) || 0;
    const gst = subtotal * (gstPct / 100);
    const total = subtotal + gst;

    // Create Razorpay order
    const order = await createOrder(total, leagueId);

    // Save payment record
    await createPayment({
      user_id: session.user.id,
      league_id: leagueId,
      razorpay_order_id: order.id,
      base_amount: safeBase,
      platform_fee: safePlatform,
      gst_amount: gst,
      total_amount: total,
      currency: 'INR',
      purpose: 'league_creation',
      description: `Payment for league creation`,
      notes: {
        ...(tierId ? { tierId: String(tierId), pricingId: pricing.id } : { pricingId: pricing.id }),
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
