/**
 * =====================================================================================
 * League Tier Pricing Service
 * =====================================================================================
 * 
 * RESPONSIBILITY: Calculate league prices based on tier configuration
 * 
 * CORE PRINCIPLES:
 * 1. Backend is the SINGLE SOURCE OF TRUTH for pricing
 * 2. Frontend NEVER calculates prices (only displays)
 * 3. All calculations use database tier configuration
 * 4. Pricing logic is reused for preview AND actual creation
 * 5. All monetary values use Decimal/number (never float for money)
 * 
 * PRICING MODELS:
 * - FIXED: Single price regardless of duration/participants
 * - DYNAMIC: Calculated based on duration + participants + base fee
 * 
 * FORMULA (Dynamic):
 *   total = (days × per_day_rate) + (participants × per_participant_rate) + base_fee
 * 
 * SECURITY:
 * - Validates tier exists and is active
 * - Enforces tier limits (max_days, max_participants)
 * - Returns errors for invalid configurations
 * - Admin-only tier modifications
 */

import { createServerClient } from '@/lib/supabase/server';

// =====================================================================================
// TYPE DEFINITIONS
// =====================================================================================

export interface TierPricingConfig {
  id: string;
  tier_name: string;
  pricing_type: 'fixed' | 'dynamic';
  fixed_price: number | null;
  base_fee: number;
  per_day_rate: number;
  per_participant_rate: number;
  gst_percentage: number;
  config: Record<string, any>;
}

export interface TierConfig {
  id: string;
  name: string;
  display_name: string;
  description: string;
  max_days: number;
  max_participants: number;
  pricing_id: string;
  is_active: boolean;
  features: string[];
  pricing: TierPricingConfig;
}

export interface PriceCalculationInput {
  tier_id: string;
  duration_days: number;
  estimated_participants: number;
}

export interface PriceBreakdown {
  tier_id: string;
  tier_name: string;
  pricing_type: 'fixed' | 'dynamic';
  
  // Input parameters
  duration_days: number;
  participants: number;
  
  // Price components (dynamic pricing only)
  base_fee?: number;
  days_cost?: number;        // duration_days × per_day_rate
  participants_cost?: number; // participants × per_participant_rate
  
  // Final amounts
  subtotal: number;           // Before GST
  gst_amount: number;
  total: number;              // Final amount to pay
  
  // Metadata
  currency: string;
  breakdown_details: string[];
}

export interface TierValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =====================================================================================
// TIER SERVICE CLASS
// =====================================================================================

export class TierPricingService {
  
  /**
   * Get active tier configuration with pricing details
   * @param tier_id - UUID of the tier
   * @param accessToken - Optional Supabase access token for auth
   * @returns Tier configuration or null if not found/inactive
   */
  static async getTierConfig(tier_id: string, accessToken?: string): Promise<TierConfig | null> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('league_tiers')
      .select(`
        id,
        name,
        display_name,
        description,
        max_days,
        max_participants,
        pricing_id,
        is_active,
        features,
        pricing:pricing_id (
          id,
          tier_name,
          pricing_type,
          fixed_price,
          base_fee,
          per_day_rate,
          per_participant_rate,
          gst_percentage,
          config
        )
      `)
      .eq('id', tier_id)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      console.error('Failed to fetch tier config:', error);
      return null;
    }
    
    // Transform the data to match TierConfig type
    const pricing = Array.isArray(data.pricing) ? data.pricing[0] : data.pricing;
    
    return {
      ...data,
      pricing: pricing as TierPricingConfig,
      tier_id: data.id,
    } as TierConfig;
  }
  
  /**
   * Get all active tiers for user selection
   * @param accessToken - Optional Supabase access token for auth
   * @returns List of active tiers ordered by display_order
   */
  static async getActiveTiers(accessToken?: string): Promise<TierConfig[]> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('league_tiers')
      .select(`
        id,
        name,
        display_name,
        description,
        max_days,
        max_participants,
        pricing_id,
        is_active,
        features,
        display_order,
        pricing:pricing_id (
          id,
          tier_name,
          pricing_type,
          fixed_price,
          base_fee,
          per_day_rate,
          per_participant_rate,
          gst_percentage,
          config
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error || !data) {
      console.error('Failed to fetch active tiers:', error);
      return [];
    }
    
    // Transform the data to match TierConfig type
    return data.map((tier: any) => ({
      ...tier,
      pricing: Array.isArray(tier.pricing) ? tier.pricing[0] : tier.pricing,
      tier_id: tier.id,
    })) as TierConfig[];
  }
  
  /**
   * Validate league parameters against tier limits
   * @param tier_id - UUID of the tier
   * @param duration_days - Requested league duration
   * @param participants - Estimated participant count
   * @param accessToken - Optional Supabase access token for auth
   * @returns Validation result with errors/warnings
   */
  static async validateTierLimits(
    tier_id: string,
    duration_days: number,
    participants: number,
    accessToken?: string
  ): Promise<TierValidationResult> {
    const result: TierValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Input validation
    if (duration_days <= 0) {
      result.errors.push('Duration must be at least 1 day');
      result.valid = false;
    }
    
    if (participants <= 0) {
      result.errors.push('Must have at least 1 participant');
      result.valid = false;
    }
    
    // Fetch tier configuration
    const tier = await this.getTierConfig(tier_id);
    
    if (!tier) {
      result.errors.push('Invalid or inactive tier selected');
      result.valid = false;
      return result;
    }
    
    // Validate against tier limits
    if (duration_days > tier.max_days) {
      result.errors.push(
        `Duration (${duration_days} days) exceeds tier limit (${tier.max_days} days)`
      );
      result.valid = false;
    }
    
    if (participants > tier.max_participants) {
      result.errors.push(
        `Participant count (${participants}) exceeds tier limit (${tier.max_participants})`
      );
      result.valid = false;
    }
    
    // Add warnings for approaching limits (80% threshold)
    if (duration_days > tier.max_days * 0.8) {
      result.warnings.push(
        `Duration is close to tier limit (${tier.max_days} days)`
      );
    }
    
    if (participants > tier.max_participants * 0.8) {
      result.warnings.push(
        `Participant count is close to tier limit (${tier.max_participants})`
      );
    }
    
    return result;
  }
  
  /**
   * Calculate price for a league based on tier configuration
   * 
   * PRICING LOGIC:
   * - Fixed: Uses fixed_price from pricing table
   * - Dynamic: Calculates based on formula:
   *     total = (days × per_day_rate) + (participants × per_participant_rate) + base_fee
   * 
   * GST is added to subtotal to get final amount
   * 
   * @param input - Pricing calculation parameters
   * @returns Price breakdown or null if tier invalid
   */
  static async calculatePrice(
    input: PriceCalculationInput
  ): Promise<PriceBreakdown | null> {
    const { tier_id, duration_days, estimated_participants } = input;
    
    // Validate inputs first
    const validation = await this.validateTierLimits(
      tier_id,
      duration_days,
      estimated_participants
    );
    
    if (!validation.valid) {
      console.error('Validation failed:', validation.errors);
      return null;
    }
    
    // Get tier configuration
    const tier = await this.getTierConfig(tier_id);
    
    if (!tier) {
      return null;
    }
    
    const pricing = tier.pricing;
    let subtotal = 0;
    const breakdown_details: string[] = [];
    
    // Calculate based on pricing type
    if (pricing.pricing_type === 'fixed') {
      // FIXED PRICING
      subtotal = pricing.fixed_price || 0;
      breakdown_details.push(`Fixed price: ₹${subtotal.toFixed(2)}`);
      
      return {
        tier_id: tier.id,
        tier_name: tier.display_name,
        pricing_type: 'fixed',
        duration_days,
        participants: estimated_participants,
        subtotal,
        gst_amount: this.calculateGST(subtotal, pricing.gst_percentage),
        total: this.calculateTotal(subtotal, pricing.gst_percentage),
        currency: 'INR',
        breakdown_details
      };
      
    } else if (pricing.pricing_type === 'dynamic') {
      // DYNAMIC PRICING
      const base_fee = pricing.base_fee || 0;
      const days_cost = duration_days * (pricing.per_day_rate || 0);
      const participants_cost = estimated_participants * (pricing.per_participant_rate || 0);
      
      subtotal = base_fee + days_cost + participants_cost;
      
      // Build detailed breakdown
      if (base_fee > 0) {
        breakdown_details.push(`Base fee: ₹${base_fee.toFixed(2)}`);
      }
      if (days_cost > 0) {
        breakdown_details.push(
          `Duration: ${duration_days} days × ₹${pricing.per_day_rate} = ₹${days_cost.toFixed(2)}`
        );
      }
      if (participants_cost > 0) {
        breakdown_details.push(
          `Participants: ${estimated_participants} × ₹${pricing.per_participant_rate} = ₹${participants_cost.toFixed(2)}`
        );
      }
      
      return {
        tier_id: tier.id,
        tier_name: tier.display_name,
        pricing_type: 'dynamic',
        duration_days,
        participants: estimated_participants,
        base_fee,
        days_cost,
        participants_cost,
        subtotal,
        gst_amount: this.calculateGST(subtotal, pricing.gst_percentage),
        total: this.calculateTotal(subtotal, pricing.gst_percentage),
        currency: 'INR',
        breakdown_details
      };
    }
    
    return null;
  }
  
  /**
   * Calculate GST amount
   * @param subtotal - Amount before tax
   * @param gst_percentage - GST percentage (e.g., 18 for 18%)
   * @returns GST amount rounded to 2 decimals
   */
  private static calculateGST(subtotal: number, gst_percentage: number): number {
    return Math.round((subtotal * gst_percentage) / 100 * 100) / 100;
  }
  
  /**
   * Calculate total amount (subtotal + GST)
   * @param subtotal - Amount before tax
   * @param gst_percentage - GST percentage
   * @returns Total amount rounded to 2 decimals
   */
  private static calculateTotal(subtotal: number, gst_percentage: number): number {
    const gst = this.calculateGST(subtotal, gst_percentage);
    return Math.round((subtotal + gst) * 100) / 100;
  }
  
  /**
   * Create tier snapshot for league creation
   * 
   * PURPOSE: Lock tier configuration at league creation time
   * This prevents retroactive changes when admin modifies tier settings
   * 
   * @param tier_id - UUID of the tier
   * @param duration_days - League duration in days
   * @param estimated_participants - Estimated number of participants
   * @returns Snapshot object to store in league.tier_snapshot
   */
  static async createTierSnapshot(
    tier_id: string,
    duration_days: number,
    estimated_participants: number
  ): Promise<Record<string, any> | null> {
    const tier = await this.getTierConfig(tier_id);
    
    if (!tier) {
      return null;
    }

    // Calculate pricing for this specific configuration
    const priceBreakdown = await this.calculatePrice({
      tier_id,
      duration_days,
      estimated_participants
    });

    if (!priceBreakdown) {
      console.error('Failed to calculate price for tier snapshot');
      return null;
    }
    
    return {
      tier_id: tier.id,
      tier_name: tier.name,
      display_name: tier.display_name,
      max_days: tier.max_days,
      max_participants: tier.max_participants,
      features: tier.features,
      pricing: {
        pricing_type: tier.pricing.pricing_type,
        fixed_price: tier.pricing.fixed_price,
        base_fee: tier.pricing.base_fee,
        per_day_rate: tier.pricing.per_day_rate,
        per_participant_rate: tier.pricing.per_participant_rate,
        gst_percentage: tier.pricing.gst_percentage,
        // Include calculated amounts for this league
        subtotal: priceBreakdown.subtotal,
        gst_amount: priceBreakdown.gst_amount,
        total: priceBreakdown.total,
        breakdown_details: priceBreakdown.breakdown_details
      },
      league_config: {
        duration_days,
        estimated_participants
      },
      snapshot_created_at: new Date().toISOString()
    };
  }
}

// =====================================================================================
// HELPER FUNCTIONS
// =====================================================================================

/**
 * Format currency for display
 * @param amount - Numeric amount
 * @param currency - Currency code (default: INR)
 * @returns Formatted string (e.g., "₹1,234.56")
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : '$';
  return `${symbol}${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format tier limits for display
 * @param tier - Tier configuration
 * @returns Human-readable limits string
 */
export function formatTierLimits(tier: TierConfig): string {
  return `Up to ${tier.max_days} days, ${tier.max_participants} participants`;
}
