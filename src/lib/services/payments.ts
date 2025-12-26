/**
 * Payments Service
 * Handles all payment-related database operations.
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentPurpose = 'league_creation' | 'subscription' | 'other';

export interface Payment {
  payment_id: string;
  user_id: string;
  league_id: string | null;
  purpose: PaymentPurpose;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: PaymentStatus;
  base_amount: number;
  platform_fee: number;
  gst_amount: number;
  total_amount: number;
  currency: string;
  description: string | null;
  receipt: string | null;
  notes: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreatePaymentInput {
  user_id: string;
  league_id: string;
  razorpay_order_id: string;
  base_amount: number;
  platform_fee: number;
  gst_amount: number;
  total_amount: number;
  currency?: string;
  purpose?: PaymentPurpose;
  description?: string;
  receipt?: string;
  notes?: Record<string, any>;
}

/**
 * Create a new payment record
 */
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: input.user_id,
      league_id: input.league_id,
      razorpay_order_id: input.razorpay_order_id,
      base_amount: input.base_amount,
      platform_fee: input.platform_fee,
      gst_amount: input.gst_amount,
      total_amount: input.total_amount,
      currency: input.currency ?? 'INR',
      purpose: input.purpose || 'league_creation',
      description: input.description,
      receipt: input.receipt || `league_${input.league_id}`,
      notes: input.notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating payment:', error);
    throw new Error('Failed to create payment record: ' + error.message);
  }

  return data as Payment;
}

/**
 * Update payment status after Razorpay verification
 */
export async function updatePaymentStatus(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  status: 'completed' | 'failed'
): Promise<Payment> {
  const supabase = getSupabaseServiceRole();

  const updateData: any = {
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    status,
  };

  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('payments')
    .update(updateData)
    .eq('razorpay_order_id', razorpayOrderId)
    .select()
    .single();

  if (error) {
    console.error('Error updating payment:', error);
    throw new Error('Failed to update payment: ' + error.message);
  }

  return data as Payment;
}

/**
 * Get payment by Razorpay order ID
 */
export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single();

  if (error) {
    console.error('Error fetching payment:', error);
    return null;
  }

  return data as Payment;
}

/**
 * Get all payments for a user
 */
export async function getPaymentsForUser(userId: string): Promise<Payment[]> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user payments:', error);
    return [];
  }

  return data as Payment[];
}

/**
 * Get all payments for a league
 */
export async function getPaymentsForLeague(leagueId: string): Promise<Payment[]> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching league payments:', error);
    return [];
  }

  return data as Payment[];
}

/**
 * Get all payments (admin dashboard)
 */
export async function getAllPayments(options?: {
  status?: PaymentStatus;
  purpose?: PaymentPurpose;
  limit?: number;
  offset?: number;
}): Promise<{ payments: Payment[]; total: number }> {
  const supabase = getSupabaseServiceRole();

  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.purpose) {
    query = query.eq('purpose', options.purpose);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching all payments:', error);
    return { payments: [], total: 0 };
  }

  return { payments: data as Payment[], total: count || 0 };
}

/**
 * Get revenue statistics (admin dashboard)
 */
export async function getRevenueStats(): Promise<{
  totalRevenue: number;
  monthlyRevenue: number;
  completedPayments: number;
  pendingPayments: number;
}> {
  const supabase = getSupabaseServiceRole();

  // Get all completed payments
  const { data: completed, error: completedError } = await supabase
    .from('payments')
    .select('total_amount')
    .eq('status', 'completed');

  if (completedError) {
    console.error('Error fetching revenue:', completedError);
    return { totalRevenue: 0, monthlyRevenue: 0, completedPayments: 0, pendingPayments: 0 };
  }

  // Get pending count
  const { count: pendingCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Calculate totals
  const totalRevenue = (completed || []).reduce((sum, p) => sum + Number(p.total_amount), 0);

  // Get current month's revenue
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthly } = await supabase
    .from('payments')
    .select('total_amount')
    .eq('status', 'completed')
    .gte('completed_at', startOfMonth.toISOString());

  const monthlyRevenue = (monthly || []).reduce((sum, p) => sum + Number(p.total_amount), 0);

  return {
    totalRevenue,
    monthlyRevenue,
    completedPayments: completed?.length || 0,
    pendingPayments: pendingCount || 0,
  };
}
