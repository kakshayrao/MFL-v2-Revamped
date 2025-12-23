import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import {
  getActivityById,
  updateActivity,
  deleteActivity,
} from '@/lib/services/admin';
import type { AdminActivityUpdateInput } from '@/types/admin';

interface RouteParams {
  params: Promise<{ activityId: string }>;
}

/**
 * GET /api/admin/activities/[activityId]
 * Get a single activity by ID
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { activityId } = await params;
    const activity = await getActivityById(activityId);

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    return NextResponse.json({ data: activity });
  } catch (error) {
    console.error('Error in admin activity GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/activities/[activityId]
 * Update an activity
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { activityId } = await params;
    const body = await req.json();

    const input: AdminActivityUpdateInput = {};

    if (body.activity_name !== undefined) input.activity_name = body.activity_name;
    if (body.description !== undefined) input.description = body.description;
    if (body.category_id !== undefined) input.category_id = body.category_id;

    const adminUserId = (session.user as any)?.id;
    const activity = await updateActivity(activityId, input, adminUserId);

    if (!activity) {
      return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
    }

    return NextResponse.json({ data: activity });
  } catch (error) {
    console.error('Error in admin activity PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/activities/[activityId]
 * Delete an activity (hard delete since no is_active field)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.platform_role;
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { activityId } = await params;
    const success = await deleteActivity(activityId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete activity. It may be in use by leagues.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error in admin activity DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
