/**
 * Admin Panel TypeScript Types
 * Aligned with Supabase database schema
 */

// ============================================================================
// User Types
// ============================================================================

export interface AdminUser {
  user_id: string;
  username: string;
  email: string;
  password_hash?: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  platform_role: 'admin' | 'user';
  is_active: boolean;
  created_by?: string | null;
  created_date: string;
  modified_by?: string | null;
  modified_date: string;
}

export interface AdminUserCreateInput {
  username: string;
  email: string;
  password_hash: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  platform_role?: 'admin' | 'user';
}

export interface AdminUserUpdateInput {
  username?: string;
  email?: string;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  platform_role?: 'admin' | 'user';
  is_active?: boolean;
}

// ============================================================================
// League Types
// ============================================================================

export type LeagueStatus = 'draft' | 'launched' | 'active' | 'completed';

export interface AdminLeague {
  league_id: string;
  league_name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  status: LeagueStatus;
  is_active: boolean;
  num_teams: number;
  tier_id?: string | null;
  rest_days: number;
  auto_rest_day_enabled: boolean;
  normalize_points_by_capacity: boolean;
  is_public: boolean;
  is_exclusive: boolean;
  invite_code?: string | null;
  created_by?: string | null;
  created_date: string;
  modified_by?: string | null;
  modified_date: string;
  // Computed fields
  member_count?: number;
  league_capacity?: number;
}

export interface AdminLeagueCreateInput {
  league_name: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  num_teams?: number;
  tier_id?: string;
  rest_days?: number;
  auto_rest_day_enabled?: boolean;
  normalize_points_by_capacity?: boolean;
  is_public?: boolean;
  is_exclusive?: boolean;
}

export interface AdminLeagueUpdateInput {
  league_name?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  status?: LeagueStatus;
  is_active?: boolean;
  num_teams?: number;
  tier_id?: string;
  rest_days?: number;
  auto_rest_day_enabled?: boolean;
  normalize_points_by_capacity?: boolean;
  is_public?: boolean;
  is_exclusive?: boolean;
}

// ============================================================================
// League Tier Types
// ============================================================================

export type TierPricingType = 'fixed' | 'dynamic';

export interface AdminTier {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  pricing_type: TierPricingType;
  fixed_price?: number | null;
  base_fee?: number | null;
  per_day_rate?: number | null;
  per_participant_rate?: number | null;
  gst_percentage?: number;
  max_days: number;
  max_participants: number;
  pricing_id?: string;
  display_order?: number;
  is_featured?: boolean;
  features?: string[];
  is_active: boolean;
  active_leagues?: number;
  total_leagues?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AdminTierCreateInput {
  name: string;
  display_name: string;
  description?: string | null;
  pricing_type: TierPricingType;
  fixed_price?: number | null;
  base_fee?: number | null;
  per_day_rate?: number | null;
  per_participant_rate?: number | null;
  gst_percentage?: number;
  max_days: number;
  max_participants: number;
  display_order?: number;
  is_featured?: boolean;
  features?: string[];
}

export interface AdminTierUpdateInput extends Partial<AdminTierCreateInput> {
  is_active?: boolean;
}

// ============================================================================
// Activity Types
// ============================================================================

// Activity Category
export interface ActivityCategory {
  category_id: string;
  category_name: string;
  display_name: string;
  description?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityCategoryCreateInput {
  category_name: string;
  display_name: string;
  description?: string | null;
  display_order?: number;
}

export interface ActivityCategoryUpdateInput {
  category_name?: string;
  display_name?: string;
  description?: string | null;
  display_order?: number;
}

export interface AdminActivity {
  activity_id: string;
  activity_name: string;
  description?: string | null;
  category_id?: string | null;
  category?: ActivityCategory | null;
  created_by?: string | null;
  created_date: string;
  modified_by?: string | null;
  modified_date: string;
}

export interface AdminActivityCreateInput {
  activity_name: string;
  description?: string | null;
  category_id?: string | null;
}

export interface AdminActivityUpdateInput {
  activity_name?: string;
  description?: string | null;
  category_id?: string | null;
}

// ============================================================================
// Role Types
// ============================================================================

export interface AdminRole {
  role_id: string;
  role_name: string;
  created_by?: string | null;
  created_date: string;
  modified_by?: string | null;
  modified_date: string;
  // Computed fields
  user_count?: number;
}

export interface AdminRoleCreateInput {
  role_name: string;
}

export interface AdminRoleUpdateInput {
  role_name?: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentPurpose = 'league_creation' | 'subscription' | 'other';

export interface AdminPayment {
  payment_id: string;
  user_id: string;
  league_id?: string | null;
  purpose: PaymentPurpose;
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  razorpay_signature?: string | null;
  status: PaymentStatus;
  base_amount: number;
  platform_fee: number;
  gst_amount: number;
  total_amount: number;
  currency: string;
  description?: string | null;
  receipt?: string | null;
  notes?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  // Joined fields
  user?: {
    username: string;
    email: string;
  };
  league?: {
    league_name: string;
  };
}

// ============================================================================
// Dashboard Stats Types
// ============================================================================

export interface DashboardStats {
  totalUsers: number;
  totalUsersChange: number;
  activeLeagues: number;
  activeLeaguesChange: number;
  totalSubmissions: number;
  submissionsChange: number;
  totalRevenue: number;
  revenueChange: number;
}

export interface RevenueStats {
  totalRevenue: number;
  totalRevenueChange: number;
  monthlyRevenue: number;
  monthlyRevenueChange: number;
  totalTransactions: number;
  transactionsChange: number;
  avgTransaction: number;
  avgTransactionChange: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AdminApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AdminPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Filter Types
// ============================================================================

export interface AdminUserFilters {
  search?: string;
  platform_role?: 'admin' | 'user' | 'all';
  is_active?: boolean | 'all';
}

export interface AdminLeagueFilters {
  search?: string;
  status?: LeagueStatus | 'all';
  is_active?: boolean | 'all';
}

export interface AdminActivityFilters {
  search?: string;
  category_id?: string;
}

export interface AdminRoleFilters {
  search?: string;
}

export interface AdminPaymentFilters {
  search?: string;
  status?: PaymentStatus | 'all';
  purpose?: PaymentPurpose | 'all';
  startDate?: string;
  endDate?: string;
}
