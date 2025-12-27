/**
 * Admin Authentication Helpers
 * Server-side admin verification using Supabase auth + RLS
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { createServerClient } from '@/lib/supabase/server';

export interface AdminVerificationResult {
  success: boolean;
  userId?: string;
  accessToken?: string;
  error?: string;
}

/**
 * Extract Supabase access token from Authorization header
 */
export function extractAccessToken(req: NextRequest): string | undefined {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  return authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
}

/**
 * Verify admin access using NextAuth session + Supabase token
 * 
 * This function:
 * 1. Checks NextAuth session for initial auth
 * 2. Extracts Supabase access token from request
 * 3. Verifies token with Supabase auth
 * 4. Checks user's platform_role in database
 * 
 * @param req - Next.js request object
 * @returns Admin verification result with userId and accessToken if successful
 */
export async function verifyAdminAccess(req: NextRequest): Promise<AdminVerificationResult> {
  // Step 1: Check NextAuth session
  const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
  
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: No session' };
  }

  const sessionRole = (session.user as any)?.platform_role;
  if (sessionRole !== 'admin') {
    return { success: false, error: 'Forbidden: Not an admin' };
  }

  // Step 2: Extract Supabase access token
  const accessToken = extractAccessToken(req);
  
  if (!accessToken) {
    return { success: false, error: 'Unauthorized: Missing Supabase access token' };
  }

  // Step 3: Verify token with Supabase
  const supabase = createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !user) {
    return { success: false, error: 'Unauthorized: Invalid Supabase token' };
  }

  // Step 4: Verify admin role in database
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('platform_role')
    .eq('user_id', user.id)
    .single();

  if (userError || userData?.platform_role !== 'admin') {
    return { success: false, error: 'Forbidden: Admin access required' };
  }

  return {
    success: true,
    userId: user.id,
    accessToken
  };
}

/**
 * Simple admin check (NextAuth session only, no token required)
 * Use this for read-only operations that don't need RLS context
 */
export async function checkAdminSession(): Promise<{ success: boolean; userId?: string; error?: string }> {
  const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
  
  if (!session?.user) {
    return { success: false, error: 'Unauthorized: No session' };
  }

  const sessionRole = (session.user as any)?.platform_role;
  const userId = (session.user as any)?.id;

  if (sessionRole !== 'admin') {
    return { success: false, error: 'Forbidden: Not an admin' };
  }

  return { success: true, userId };
}
