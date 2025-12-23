/**
 * POST /api/upload/challenge-proof
 * Uploads challenge proof images to Supabase Storage (bucket: challenge-proofs by default).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

const CHALLENGE_PROOF_BUCKET = process.env.NEXT_PUBLIC_CHALLENGE_PROOF_BUCKET || 'challenge-proofs';

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const supabase = getSupabaseServiceRole();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const leagueId = formData.get('league_id') as string;
    const challengeId = formData.get('challenge_id') as string;

    if (!file) return buildError('No file provided', 400);
    if (!leagueId) return buildError('league_id is required', 400);
    if (!challengeId) return buildError('challenge_id is required', 400);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return buildError('Invalid file type. Allowed: JPG, PNG, GIF, WebP', 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return buildError('File too large. Maximum size is 10MB', 400);
    }

    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `${leagueId}/${challengeId}/${session.user.id}/${Date.now()}.${extension}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { error: uploadError } = await supabase.storage
      .from(CHALLENGE_PROOF_BUCKET)
      .upload(fileName, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Storage upload error (challenge proof):', uploadError);
      return buildError('Failed to upload file: ' + uploadError.message, 500);
    }

    const { data: urlData } = supabase.storage
      .from(CHALLENGE_PROOF_BUCKET)
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: fileName,
        bucket: CHALLENGE_PROOF_BUCKET,
      },
    });
  } catch (error) {
    console.error('Error in upload/challenge-proof:', error);
    return buildError('Internal server error', 500);
  }
}
