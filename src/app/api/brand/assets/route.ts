import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/brand/assets - List all assets
export async function GET(request: NextRequest) {
  try {
    const { data: brand } = await supabaseAdmin
      .from('brand_profiles')
      .select('id')
      .limit(1)
      .single()

    if (!brand) {
      return NextResponse.json({ assets: [] })
    }

    const { data, error } = await supabaseAdmin
      .from('brand_assets')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assets: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/brand/assets - Upload a new asset
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const assetType = formData.get('asset_type') as string | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!assetType) {
      return NextResponse.json({ error: 'asset_type is required' }, { status: 400 })
    }

    const { data: brand } = await supabaseAdmin
      .from('brand_profiles')
      .select('id')
      .limit(1)
      .single()

    if (!brand) {
      return NextResponse.json({ error: 'Brand profile not found. Please set up your brand first.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const ext = file.name.split('.').pop() || 'bin'
    const storageName = `${brand.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('brand-assets')
      .upload(storageName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('brand-assets')
      .getPublicUrl(storageName)

    const { data: asset, error: dbError } = await supabaseAdmin
      .from('brand_assets')
      .insert({
        brand_id: brand.id,
        asset_type: assetType,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        description,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ asset })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/brand/assets?id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('id')

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })
    }

    const { data: asset } = await supabaseAdmin
      .from('brand_assets')
      .select('id, file_url')
      .eq('id', assetId)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const urlPath = asset.file_url.split('/brand-assets/')[1]
    if (urlPath) {
      await supabaseAdmin.storage.from('brand-assets').remove([urlPath])
    }

    const { error } = await supabaseAdmin
      .from('brand_assets')
      .delete()
      .eq('id', assetId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}