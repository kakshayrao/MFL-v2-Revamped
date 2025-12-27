import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { deleteActivityCategory } from '@/lib/services/admin/admin-categories';

// DELETE /api/admin/activity-categories/[categoryId] - Delete a category (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any)?.platform_role;
    if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { categoryId } = await params;
    if (!categoryId) return NextResponse.json({ error: 'Category id required' }, { status: 400 });

    // Extract Supabase access token from Authorization header
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    try {
      await deleteActivityCategory(categoryId, accessToken);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to delete category' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Category deleted' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
