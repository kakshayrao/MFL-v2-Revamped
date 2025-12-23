import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import {
  updateChallenge,
  deleteChallenge,
  type UpdateChallengeInput,
} from '@/lib/services/admin'

/**
 * PATCH /api/admin/challenges/[id]
 * Update a preset challenge
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // For now, allow all authenticated users
    // You can add admin role check if needed

    const body = await req.json()
    const { name, description, challenge_type, doc_url } = body

    const input: UpdateChallengeInput = {}
    if (name !== undefined) input.name = name
    if (description !== undefined) input.description = description
    if (challenge_type !== undefined) input.challenge_type = challenge_type
    if (doc_url !== undefined) input.doc_url = doc_url

    const challenge = await updateChallenge(id, input)

    if (!challenge) {
      return NextResponse.json({ success: false, error: 'Failed to update challenge' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: challenge })
  } catch (error) {
    console.error('Error in admin challenges PATCH:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/challenges/[id]
 * Delete a preset challenge
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // For now, allow all authenticated users
    // You can add admin role check if needed

    const success = await deleteChallenge(id)

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete challenge' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in admin challenges DELETE:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
