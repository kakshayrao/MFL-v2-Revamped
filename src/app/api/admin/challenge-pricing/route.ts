import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user) return jsonError('Unauthorized', 401);

    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from('challengepricing')
      .select('pricing_id, per_day_rate, tax, admin_markup, created_at, modified_at')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('challengepricing GET error', error);
      return jsonError('Failed to load pricing', 500);
    }

    return NextResponse.json({ success: true, data: data || null });
  } catch (err) {
    console.error('challengepricing GET unexpected', err);
    return jsonError('Internal server error', 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user) return jsonError('Unauthorized', 401);

    const body = await req.json();
    const per_day_rate = Number(body.per_day_rate);
    const tax = body.tax !== undefined && body.tax !== null ? Number(body.tax) : null;
    const admin_markup = body.admin_markup !== undefined && body.admin_markup !== null ? Number(body.admin_markup) : null;

    if (!Number.isFinite(per_day_rate) || per_day_rate < 0) {
      return jsonError('per_day_rate must be a non-negative number');
    }
    if (tax !== null && !Number.isFinite(tax)) {
      return jsonError('tax must be a number');
    }
    if (admin_markup !== null && !Number.isFinite(admin_markup)) {
      return jsonError('admin_markup must be a number');
    }

    const supabase = getSupabaseServiceRole();

    // Upsert single row
    const { data, error } = await supabase
      .from('challengepricing')
      .upsert({ per_day_rate, tax, admin_markup }, { onConflict: 'pricing_id' })
      .select('pricing_id, per_day_rate, tax, admin_markup, created_at, modified_at')
      .maybeSingle();

    if (error) {
      console.error('challengepricing PUT error', error);
      return jsonError('Failed to save pricing', 500);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('challengepricing PUT unexpected', err);
    return jsonError('Internal server error', 500);
  }
}
