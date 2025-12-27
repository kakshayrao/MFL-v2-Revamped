/**
 * Pricing Service
 * Handles pricing configuration for league creation.
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';

export interface Pricing {
  id: string;
  base_price: number;
  platform_fee: number;
  gst_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Get the active pricing configuration
 */
export async function getPricing(): Promise<Pricing | null> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching pricing:', error);
    return null;
  }

  return data as Pricing | null;
}

/**
 * Get pricing configuration by id
 */
export async function getPricingById(pricingId: string): Promise<Pricing | null> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('pricing')
    .select('*')
    .eq('id', pricingId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching pricing by id:', error);
    return null;
  }

  return data as Pricing | null;
}

/**
 * Update pricing (admin only)
 * Creates a new active pricing record and deactivates the old one
 */
export async function updatePricing(
  userId: string,
  pricing: { base_price: number; platform_fee: number; gst_percentage: number }
): Promise<Pricing> {
  const supabase = getSupabaseServiceRole();

  // Deactivate all existing pricing
  await supabase
    .from('pricing')
    .update({ is_active: false })
    .eq('is_active', true);

  // Insert new pricing as active
  const { data, error } = await supabase
    .from('pricing')
    .insert({
      base_price: pricing.base_price,
      platform_fee: pricing.platform_fee,
      gst_percentage: pricing.gst_percentage,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating pricing:', error);
    throw new Error('Failed to update pricing: ' + error.message);
  }

  return data as Pricing;
}

/**
 * Calculate total amount with GST
 */
export function calculateTotal(
  basePrice: number,
  platformFee: number,
  gstPercentage: number
): { subtotal: number; gst: number; total: number } {
  const subtotal = basePrice + platformFee;
  const gst = subtotal * (gstPercentage / 100);
  const total = subtotal + gst;
  return { subtotal, gst, total };
}

/**
 * Get pricing breakdown for display
 */
export async function getPricingBreakdown(): Promise<{
  basePrice: number;
  platformFee: number;
  gstPercentage: number;
  subtotal: number;
  gst: number;
  total: number;
} | null> {
  const pricing = await getPricing();
  if (!pricing) return null;

  const { subtotal, gst, total } = calculateTotal(
    pricing.base_price,
    pricing.platform_fee,
    pricing.gst_percentage
  );

  return {
    basePrice: pricing.base_price,
    platformFee: pricing.platform_fee,
    gstPercentage: pricing.gst_percentage,
    subtotal,
    gst,
    total,
  };
}
