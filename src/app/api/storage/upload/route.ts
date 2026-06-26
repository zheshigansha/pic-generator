import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const ALLOWED_BUCKET = 'clothing-images'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function safePath(path: string) {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .filter(Boolean)
    .join('/')
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(getClientKey(request, 'storage-upload'), 60, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many uploads' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      }
    )
  }

  const formData = await request.formData()
  const bucket = formData.get('bucket')
  const file = formData.get('file')
  const rawPath = formData.get('path')

  if (bucket !== ALLOWED_BUCKET || !(file instanceof File) || typeof rawPath !== 'string') {
    return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Invalid image file' }, { status: 400 })
  }

  const path = safePath(rawPath)
  if (!path || path.length > 500) {
    return NextResponse.json({ error: 'Invalid upload path' }, { status: 400 })
  }

  const supabase = createServiceSupabase()
  const { data, error } = await supabase.storage
    .from(ALLOWED_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(ALLOWED_BUCKET).getPublicUrl(data.path)
  return NextResponse.json({ publicUrl: urlData.publicUrl })
}
