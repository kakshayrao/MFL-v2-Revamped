/**
 * GET /api/leagues/tiers
 * Returns all active league tiers with their pricing configuration.
 * This endpoint is used by the league creation flow to display available tiers.
 */

import { NextResponse } from 'next/server';
import { TierPricingService } from '@/lib/services/tier-pricing';

export async function GET() {
  try {
    // Fetch all active tiers using the TierPricingService
    const tiers = await TierPricingService.getActiveTiers();

    if (!tiers || tiers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: { tiers: [] },
        message: 'No active tiers available. Please contact admin.'
      });
    }

    // Transform to match expected frontend format
    const transformedTiers = tiers.map(tier => ({
      tier_id: tier.id,
      tier_name: tier.name,
      display_name: tier.display_name,
      description: tier.description,
      max_days: tier.max_days,
      max_participants: tier.max_participants,
      is_featured: tier.features?.includes?.('featured') || false,
      features: tier.features || [],
      pricing: {
        id: tier.pricing.id,
        pricing_type: tier.pricing.pricing_type,
        fixed_price: tier.pricing.fixed_price,
        base_fee: tier.pricing.base_fee,
        per_day_rate: tier.pricing.per_day_rate,
        per_participant_rate: tier.pricing.per_participant_rate,
        gst_percentage: tier.pricing.gst_percentage,
      }
    }));

    return NextResponse.json({ 
      success: true, 
      data: { tiers: transformedTiers } 
    });

  } catch (err) {
    console.error('Error in /api/leagues/tiers:', err);
    return NextResponse.json({ 
      error: 'Failed to fetch tiers',
      message: err instanceof Error ? err.message : 'Internal server error'
    }, { status: 500 });
  }
}
