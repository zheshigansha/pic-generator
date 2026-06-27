import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  if (!verifySession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get brand profile by user_id from cookie-based session
    // Since we use a single-password auth, we store user_id in a separate table
    // For now, return the first brand profile (single-user app)
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!verifySession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      name,
      contact_email,
      contact_phone,
      contact_whatsapp,
      website_url,
      logo_url,
      watermark_style = 'corner',
      watermark_position = 'bottom-right',
      qr_code_url,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
    }

    // Get existing profile (single-user, just take first)
    const { data: existing } = await supabase
      .from('brand_profiles')
      .select('id')
      .limit(1)
      .single()

    let result
    if (existing) {
      // Update
      const { data, error } = await supabase
        .from('brand_profiles')
        .update({
          name,
          contact_email,
          contact_phone,
          contact_whatsapp,
          website_url,
          logo_url,
          watermark_style,
          watermark_position,
          qr_code_url,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    } else {
      // Create (no user_id since we use single-password auth)
      const { data, error } = await supabase
        .from('brand_profiles')
        .insert({
          name,
          contact_email,
          contact_phone,
          contact_whatsapp,
          website_url,
          logo_url,
          watermark_style,
          watermark_position,
          qr_code_url,
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      result = data
    }

    return NextResponse.json({ profile: result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}