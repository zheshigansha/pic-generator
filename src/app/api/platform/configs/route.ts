import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const contentFormat = searchParams.get('content_format')

    let query = supabaseAdmin
      .from('platform_configs')
      .select('*')
      .eq('is_active', true)
      .order('platform')
      .order('content_format')

    if (platform) {
      query = query.eq('platform', platform)
    }
    if (contentFormat) {
      query = query.eq('content_format', contentFormat)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ configs: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}