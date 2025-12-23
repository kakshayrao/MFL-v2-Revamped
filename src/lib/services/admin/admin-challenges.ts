/**
 * Admin Challenges Service
 * Handles all preset challenge CRUD operations for the admin panel
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';

export interface PresetChallenge {
  challenge_id: string;
  name: string;
  description: string | null;
  challenge_type: 'individual' | 'team' | 'sub_team';
  doc_url: string | null;
  created_date: string;
}

export interface CreateChallengeInput {
  name: string;
  description?: string;
  challenge_type: 'individual' | 'team' | 'sub_team';
  doc_url?: string;
}

export interface UpdateChallengeInput {
  name?: string;
  description?: string;
  challenge_type?: 'individual' | 'team' | 'sub_team';
  doc_url?: string;
}

/**
 * Get all preset challenges
 */
export async function getAllChallenges(): Promise<PresetChallenge[]> {
  try {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from('specialchallenges')
      .select('*')
      .order('created_date', { ascending: false });

    if (error) {
      console.error('Error fetching preset challenges:', error);
      return [];
    }

    return (data || []) as PresetChallenge[];
  } catch (err) {
    console.error('Error in getAllChallenges:', err);
    return [];
  }
}

/**
 * Get a single preset challenge by ID
 */
export async function getChallengeById(challengeId: string): Promise<PresetChallenge | null> {
  try {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from('specialchallenges')
      .select('*')
      .eq('challenge_id', challengeId)
      .single();

    if (error) {
      console.error('Error fetching preset challenge:', error);
      return null;
    }

    return data as PresetChallenge;
  } catch (err) {
    console.error('Error in getChallengeById:', err);
    return null;
  }
}

/**
 * Create a new preset challenge
 */
export async function createChallenge(
  input: CreateChallengeInput,
  createdBy?: string
): Promise<PresetChallenge | null> {
  try {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from('specialchallenges')
      .insert({
        name: input.name,
        description: input.description || null,
        challenge_type: input.challenge_type || 'individual',
        doc_url: input.doc_url || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating preset challenge:', error);
      return null;
    }

    return data as PresetChallenge;
  } catch (err) {
    console.error('Error in createChallenge:', err);
    return null;
  }
}

/**
 * Update an existing preset challenge
 */
export async function updateChallenge(
  challengeId: string,
  input: UpdateChallengeInput
): Promise<PresetChallenge | null> {
  try {
    const supabase = getSupabaseServiceRole();

    // Only include fields that are provided
    const updateData: Record<string, any> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.challenge_type !== undefined) updateData.challenge_type = input.challenge_type;
    if (input.doc_url !== undefined) updateData.doc_url = input.doc_url;

    const { data, error } = await supabase
      .from('specialchallenges')
      .update(updateData)
      .eq('challenge_id', challengeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating preset challenge:', error);
      return null;
    }

    return data as PresetChallenge;
  } catch (err) {
    console.error('Error in updateChallenge:', err);
    return null;
  }
}

/**
 * Delete a preset challenge
 */
export async function deleteChallenge(challengeId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase
      .from('specialchallenges')
      .delete()
      .eq('challenge_id', challengeId);

    if (error) {
      console.error('Error deleting preset challenge:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in deleteChallenge:', err);
    return false;
  }
}

/**
 * Get challenge statistics
 */
export async function getChallengeStats(): Promise<{
  total: number;
  byType: Record<string, number>;
}> {
  try {
    const supabase = getSupabaseServiceRole();

    // Get all challenges
    const { data: challenges, error } = await supabase
      .from('specialchallenges')
      .select('challenge_type');

    if (error) {
      console.error('Error fetching challenge stats:', error);
      return { total: 0, byType: {} };
    }

    const byType: Record<string, number> = {
      individual: 0,
      team: 0,
      sub_team: 0,
    };

    (challenges || []).forEach((c) => {
      if (c.challenge_type in byType) {
        byType[c.challenge_type]++;
      }
    });

    return {
      total: challenges?.length || 0,
      byType,
    };
  } catch (err) {
    console.error('Error in getChallengeStats:', err);
    return { total: 0, byType: {} };
  }
}
