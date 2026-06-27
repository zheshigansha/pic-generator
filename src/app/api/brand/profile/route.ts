import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
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

    const { data: existing } = await supabaseAdmin
      .from('brand_profiles')
      .select('id')
      .limit(1)
      .single()

    let result
    if (existing) {
      const { data, error } = await supabaseAdmin
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
      const { data, error } = await supabaseAdmin
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