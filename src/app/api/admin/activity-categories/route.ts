import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getActivityCategories, createActivityCategory } from '@/lib/services/admin/admin-categories';

// GET /api/admin/activity-categories - List all categories (admin only)
export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.platform_role;
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const data = await getActivityCategories();
    // Add usage count for each category
    const { getSupabaseServiceRole } = await import('@/lib/supabase/client');
    const supabase = getSupabaseServiceRole();
    const dataWithCounts = await Promise.all(
      data.map(async (cat) => {
        const { count } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.category_id);
        return { ...cat, usage_count: count || 0 };
      })
    );
    return NextResponse.json({ data: dataWithCounts });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST /api/admin/activity-categories - Create category (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.platform_role;
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { display_name, category_name, description } = body as {
      display_name?: string;
      category_name?: string;
      description?: string | null;
    };

    if (!display_name?.trim()) {
      return NextResponse.json({ error: 'display_name is required' }, { status: 400 });
    }

    const slug = (category_name && category_name.trim().length > 0 ? category_name : display_name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const created = await createActivityCategory({
      display_name: display_name.trim(),
      category_name: slug,
      description: description ?? null,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
