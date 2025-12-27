/**
 * POST /api/submissions/[id]/reupload - Reupload a rejected submission
 *
 * Allows users to resubmit a rejected workout with updated proof/notes.
 * Creates a new submission record linked to the original rejected one.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { z } from 'zod';

const reuploadSchema = z.object({
  proof_url: z.string().url().optional(),
  notes: z.string().optional(),
  duration: z.number().positive().optional(),
  distance: z.number().positive().optional(),
  steps: z.number().int().positive().optional(),
  holes: z.number().int().positive().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // Fetch the original rejected submission
    const { data: originalSubmission, error: fetchError } = await supabase
      .from('effortentry')
      .select(`
        *,
        leaguemembers!inner(
          user_id,
          league_id
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !originalSubmission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    const leagueMember = originalSubmission.leaguemembers as any;
    if (leagueMember.user_id !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only reupload your own submissions' },
        { status: 403 }
      );
    }

    // Verify the submission is rejected
    if (originalSubmission.status !== 'rejected') {
      return NextResponse.json(
        { error: 'Only rejected submissions can be reuploaded' },
        { status: 400 }
      );
    }

    // Parse and validate the update data
    const body = await request.json();
    const validated = reuploadSchema.parse(body);

    // Create new submission as a reupload
    const { data: newSubmission, error: insertError } = await supabase
      .from('effortentry')
      .insert({
        league_member_id: originalSubmission.league_member_id,
        date: originalSubmission.date,
        type: originalSubmission.type,
        workout_type: originalSubmission.workout_type,
        duration: validated.duration ?? originalSubmission.duration,
        distance: validated.distance ?? originalSubmission.distance,
        steps: validated.steps ?? originalSubmission.steps,
        holes: validated.holes ?? originalSubmission.holes,
        rr_value: originalSubmission.rr_value,
        status: 'pending',
        proof_url: validated.proof_url ?? originalSubmission.proof_url,
        notes: validated.notes ?? originalSubmission.notes,
        reupload_of: originalSubmission.id,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating reupload:', insertError);
      return NextResponse.json(
        { error: 'Failed to create reupload' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: newSubmission,
      message: 'Submission reuploaded successfully. It will be reviewed again.',
    });
  } catch (error) {
    console.error('Error in reupload:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to reupload submission' },
      { status: 500 }
    );
  }
}
