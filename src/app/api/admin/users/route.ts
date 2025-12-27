import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess, checkAdminSession } from '@/lib/auth/admin-verify';
import {
  getAllUsers,
  createUser,
  getUserStats,
} from '@/lib/services/admin';
import type { AdminUserFilters, AdminUserCreateInput } from '@/types/admin';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/users
 * Get all users with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await checkAdminSession();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filters: AdminUserFilters = {
      search: searchParams.get('search') || undefined,
      platform_role: (searchParams.get('platform_role') as any) || 'all',
      is_active: searchParams.get('is_active') === 'true'
        ? true
        : searchParams.get('is_active') === 'false'
        ? false
        : 'all',
    };

    const users = await getAllUsers(filters);
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Error in admin users GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 */
export async function POST(req: NextRequest) {
  try {
    const adminCheck = await verifyAdminAccess(req);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const body = await req.json();
    const { username, email, password, phone, date_of_birth, gender, platform_role } = body;

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    // Hash the password
    const password_hash = await bcrypt.hash(password, 10);

    const input: AdminUserCreateInput = {
      username,
      email: email.toLowerCase(),
      password_hash,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      platform_role: platform_role || 'user',
    };

    const user = await createUser(input, adminCheck.accessToken, adminCheck.userId);

    if (!user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error('Error in admin users POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
