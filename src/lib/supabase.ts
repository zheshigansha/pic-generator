import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client - will use placeholder if env vars are missing (for SSR)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

// Helper to upload file to Supabase Storage and return public URL
export async function uploadToStorage(
  bucket: string,
  file: File | Blob,
  path: string
): Promise<string> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials not configured. Please check .env.local')
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) throw error

  // Get public URL
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}
