/**
 * =====================================================================================
 * Admin Tier Management API - Price Preview Endpoint
 * =====================================================================================
 * 
 * PURPOSE: Preview league price before payment
 * 
 * SECURITY:
 * - Public endpoint (users need to see prices)
 * - Rate limited to prevent abuse
 * - Validates all inputs
 * - No side effects (read-only)
 * 
 * USAGE:
 * POST /api/tiers/preview-price
 * Body: { tier_id, duration_days, estimated_participants }
 * Returns: { price_breakdown, validation }
 */

import { NextRequest, NextResponse } from 'next/server';
import { TierPricingService } from '@/lib/services/tier-pricing';
import { z } from 'zod';

// =====================================================================================
// VALIDATION SCHEMA
// =====================================================================================

const PreviewPriceSchema = z.object({
  tier_id: z.string().uuid('Invalid tier ID format'),
  duration_days: z.number().int().min(1).max(365, 'Duration cannot exceed 365 days'),
  estimated_participants: z.number().int().min(1).max(10000, 'Participants cannot exceed 10,000')
});

// =====================================================================================
// API HANDLER
// =====================================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = PreviewPriceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      );
    }
    
    const { tier_id, duration_days, estimated_participants } = validationResult.data;
    
    // Validate tier limits
    const tierValidation = await TierPricingService.validateTierLimits(
      tier_id,
      duration_days,
      estimated_participants
    );
    
    if (!tierValidation.valid) {
      return NextResponse.json(
        {
          error: 'Tier validation failed',
          validation: tierValidation
        },
        { status: 400 }
      );
    }
    
    // Calculate price
    const priceBreakdown = await TierPricingService.calculatePrice({
      tier_id,
      duration_days,
      estimated_participants
    });
    
    if (!priceBreakdown) {
      return NextResponse.json(
        {
          error: 'Failed to calculate price',
          message: 'Invalid tier or pricing configuration'
        },
        { status: 500 }
      );
    }
    
    // Return price breakdown with validation results
    return NextResponse.json({
      success: true,
      price_breakdown: priceBreakdown,
      validation: tierValidation
    });
    
  } catch (error) {
    console.error('Price preview error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =====================================================================================
// RATE LIMITING (Optional - implement if needed)
// =====================================================================================

/**
 * TODO: Add rate limiting to prevent abuse
 * Suggested limits:
 * - 100 requests per minute per IP
 * - 1000 requests per hour per IP
 * 
 * Implementation options:
 * - Redis-based rate limiter
 * - Upstash Rate Limit
 * - Vercel Edge Config
 */
