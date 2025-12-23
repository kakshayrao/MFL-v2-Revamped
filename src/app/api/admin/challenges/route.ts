import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import {
  getAllChallenges,
  createChallenge,
  type CreateChallengeInput,
} from '@/lib/services/admin'

/**
 * GET /api/admin/challenges
 * Get all preset challenges
 */
export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // For now, allow all authenticated users
    // You can add admin role check here if needed

    const challenges = await getAllChallenges()
    return NextResponse.json({ success: true, data: challenges })
  } catch (error) {
    console.error('Error in admin challenges GET:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/challenges
 * Create a new preset challenge
 */
export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // For now, allow all authenticated users
    // You can add admin role check here if needed

    const body = await req.json()
    const { name, description, challenge_type, doc_url } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    const input: CreateChallengeInput = {
      name,
      description,
      challenge_type: challenge_type || 'individual',
      doc_url,
    }

    const challenge = await createChallenge(input)

    if (!challenge) {
      return NextResponse.json({ success: false, error: 'Failed to create challenge' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: challenge })
  } catch (error) {
    console.error('Error in admin challenges POST:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
