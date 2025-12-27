import { getSupabaseServiceRole } from '@/lib/supabase/client';
import type { 
  ActivityCategory, 
  ActivityCategoryCreateInput, 
  ActivityCategoryUpdateInput 
} from '@/types/admin';

/**
 * Get all activity categories
 * @param accessToken - Optional Supabase access token for admin auth
 */
export async function getActivityCategories(accessToken?: string): Promise<ActivityCategory[]> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('activity_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching activity categories:', error);
    throw new Error('Failed to fetch activity categories');
  }

  return data || [];
}

/**
 * Get activity category by ID
 * @param accessToken - Optional Supabase access token for admin auth
 */
export async function getActivityCategoryById(
  categoryId: string,
  accessToken?: string
): Promise<ActivityCategory | null> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('activity_categories')
    .select('*')
    .eq('category_id', categoryId)
    .single();

  if (error) {
    console.error('Error fetching activity category:', error);
    return null;
  }

  return data;
}

/**
 * Create a new activity category
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function createActivityCategory(
  input: ActivityCategoryCreateInput,
  accessToken?: string
): Promise<ActivityCategory> {
  const supabase = getSupabaseServiceRole();

  // Get next display order if not provided
  let displayOrder = input.display_order;
  if (displayOrder === undefined) {
    const { data: categories } = await supabase
      .from('activity_categories')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);
    
    displayOrder = categories && categories.length > 0 
      ? categories[0].display_order + 1 
      : 0;
  }

  const { data, error } = await supabase
    .from('activity_categories')
    .insert({
      category_name: input.category_name,
      display_name: input.display_name,
      description: input.description || null,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating activity category:', error);
    throw new Error('Failed to create activity category');
  }

  return data;
}

/**
 * Update an activity category
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function updateActivityCategory(
  categoryId: string,
  input: ActivityCategoryUpdateInput,
  accessToken?: string
): Promise<ActivityCategory> {
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase
    .from('activity_categories')
    .update({
      ...(input.category_name !== undefined && { category_name: input.category_name }),
      ...(input.display_name !== undefined && { display_name: input.display_name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.display_order !== undefined && { display_order: input.display_order }),
      updated_at: new Date().toISOString(),
    })
    .eq('category_id', categoryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating activity category:', error);
    throw new Error('Failed to update activity category');
  }

  return data;
}

/**
 * Delete an activity category
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function deleteActivityCategory(categoryId: string, accessToken?: string): Promise<void> {
  const supabase = getSupabaseServiceRole();

  // First, check if any activities are using this category
  const { data: activities } = await supabase
    .from('activities')
    .select('activity_id')
    .eq('category_id', categoryId)
    .limit(1);

  if (activities && activities.length > 0) {
    throw new Error('Cannot delete category: activities are still using this category');
  }

  const { error } = await supabase
    .from('activity_categories')
    .delete()
    .eq('category_id', categoryId);

  if (error) {
    console.error('Error deleting activity category:', error);
    throw new Error('Failed to delete activity category');
  }
}

/**
 * Reorder activity categories
 */
export async function reorderActivityCategories(
  categoryIds: string[],
  accessToken?: string
): Promise<void> {
  const supabase = getSupabaseServiceRole();

  // Update each category with its new display order
  const updates = categoryIds.map((categoryId, index) =>
    supabase
      .from('activity_categories')
      .update({ display_order: index, updated_at: new Date().toISOString() })
      .eq('category_id', categoryId)
  );

  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error);

  if (errors.length > 0) {
    console.error('Error reordering categories:', errors);
    throw new Error('Failed to reorder activity categories');
  }
}
