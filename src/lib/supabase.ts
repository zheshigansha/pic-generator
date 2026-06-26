// Helper to upload file to Supabase Storage and return public URL
export async function uploadToStorage(
  bucket: string,
  file: File | Blob,
  path: string
): Promise<string> {
  const formData = new FormData()
  formData.append('bucket', bucket)
  formData.append('path', path)
  formData.append('file', file)

  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Storage upload failed')
  }

  return data.publicUrl
}
