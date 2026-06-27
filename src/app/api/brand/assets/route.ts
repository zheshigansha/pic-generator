import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/brand/assets - List assets for current user's brand
export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's brand
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!brand) {
      return NextResponse.json({ assets: [] })
    }

    const { data, error } = await supabase
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Get user's brand
    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!brand) {
      return NextResponse.json({ error: 'Brand profile not found. Please set up your brand first.' }, { status: 400 })
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Storage
    const fileName = `${brand.id}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('brand-assets')
      .getPublicUrl(fileName)

    // Save to database
    const { data: asset, error: dbError } = await supabase
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('id')

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID required' }, { status: 400 })
    }

    // Verify ownership
    const { data: asset } = await supabase
      .from('brand_assets')
      .select('id, brand_id, file_url')
      .eq('id', assetId)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const { data: brand } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', asset.brand_id)
      .single()

    if (!brand) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete from Storage (extract path from URL)
    const urlPath = asset.file_url.split('/brand-assets/')[1]
    if (urlPath) {
      await supabase.storage.from('brand-assets').remove([urlPath])
    }

    // Delete from DB
    const { error } = await supabase
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