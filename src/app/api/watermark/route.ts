import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WatermarkRequest {
  imageUrl: string
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json() as WatermarkRequest

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    // Download the generated image
    const imageBuffer = await downloadImage(imageUrl)

    // Get image metadata
    const imageMeta = await sharp(imageBuffer).metadata()
    const imgWidth = imageMeta.width || 1080
    const imgHeight = imageMeta.height || 1080

    // For now, create a simple text watermark as placeholder
    // In production, this would fetch brand logo/QR from brand_profiles and composite them
    const padding = Math.round(Math.min(imgWidth, imgHeight) * 0.02) // 2% padding
    const cornerRadius = Math.round(Math.min(imgWidth, imgHeight) * 0.01)

    // Build watermark overlay — dark semi-transparent box at bottom-right
    const wmBoxWidth = Math.round(imgWidth * 0.35)
    const wmBoxHeight = Math.round(imgHeight * 0.12)
    const wmBoxX = imgWidth - wmBoxWidth - padding
    const wmBoxY = imgHeight - wmBoxHeight - padding

    // Create SVG watermark overlay
    const svgOverlay = `
      <svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wmGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a1a2e" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#16213e" stop-opacity="0.75"/>
          </linearGradient>
          <rect id="wmBg" width="${wmBoxWidth}" height="${wmBoxHeight}" rx="${cornerRadius}" fill="url(#wmGrad)"/>
        </defs>
        <use href="#wmBg" x="${wmBoxX}" y="${wmBoxY}"/>
        <text
          x="${wmBoxX + 16}"
          y="${wmBoxY + wmBoxHeight * 0.35}"
          font-family="Arial, sans-serif"
          font-size="${Math.max(14, Math.round(imgWidth * 0.018))}px"
          fill="white"
          opacity="0.9"
        >Your Brand Here</text>
        <text
          x="${wmBoxX + 16}"
          y="${wmBoxY + wmBoxHeight * 0.65}"
          font-family="Arial, sans-serif"
          font-size="${Math.max(11, Math.round(imgWidth * 0.013))}px"
          fill="#a0a0c0"
          opacity="0.8"
        >contact@yourbrand.com</text>
      </svg>
    `

    const overlayBuffer = Buffer.from(svgOverlay)

    // Composite: base image + SVG overlay
    const watermarked = await sharp(imageBuffer)
      .composite([{ input: overlayBuffer }])
      .png()
      .toBuffer()

    // Upload to Supabase Storage
    const fileName = `watermarked/${Date.now()}-${Math.random().toString(36).slice(2)}.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('generated-images')
      .upload(fileName, watermarked, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('generated-images')
      .getPublicUrl(fileName)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (error) {
    console.error('Watermark API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}