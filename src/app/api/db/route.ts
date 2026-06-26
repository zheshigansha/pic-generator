import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import type { GeneratedImage, ProductAnalysis, SceneConfig } from '@/lib/database.types'
import { getClientKey, rateLimit } from '@/lib/rate-limit'

const MAX_IMAGE_COUNT = 20
const MAX_SCENE_COUNT = 10
const MAX_DATA_URL_LENGTH = 14 * 1024 * 1024
const STORAGE_BUCKET = 'clothing-images'

type RequestBody = {
  action?: string
  payload?: Record<string, unknown>
}

type ClothingItemInput = {
  imageData: string
  fileName: string
  imageUrl?: string
}

const PROJECT_STATUSES = new Set(['uploaded', 'analyzed', 'scene_set', 'generated', 'reviewed', 'published'])

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(payload: Record<string, unknown>, key: string, maxLength = 5000) {
  const value = payload[key]
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid ${key}`)
  }
  return value
}

function optionalString(value: unknown, maxLength = 5000) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error('Invalid string field')
  }
  return value
}

function isDataImage(value: string) {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(value) && value.length <= MAX_DATA_URL_LENGTH
}

function validateAnalysis(value: unknown): ProductAnalysis {
  if (!isRecord(value)) throw new Error('Invalid analysis')
  return {
    product_type: optionalString(value.product_type, 300),
    color: optionalString(value.color, 300),
    material: optionalString(value.material, 300),
    style: optionalString(value.style, 300),
    description: optionalString(value.description, 5000),
  }
}

function validateScenes(value: unknown): SceneConfig[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SCENE_COUNT) {
    throw new Error('Invalid scenes')
  }

  return value.map((item) => {
    if (!isRecord(item)) throw new Error('Invalid scene')
    const surroundings = Array.isArray(item.surroundings)
      ? item.surroundings.filter((entry): entry is string => typeof entry === 'string').slice(0, 30)
      : []
    const imagesCount = typeof item.imagesCount === 'number' ? item.imagesCount : 1

    return {
      id: optionalString(item.id, 80),
      name: optionalString(item.name, 120),
      imagesCount: Math.min(5, Math.max(1, Math.trunc(imagesCount))),
      season: optionalString(item.season, 50) || 'Spring',
      subject: optionalString(item.subject, 50) || '人',
      environment: optionalString(item.environment, 50) || '户外',
      surroundings,
      customPrompt: optionalString(item.customPrompt, 3000),
      preset_id: optionalString(item.preset_id, 80) || undefined,
    }
  })
}

function validateGeneratedImages(value: unknown): GeneratedImage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error('Invalid generated images')
  }

  return value.map((item) => {
    if (!isRecord(item)) throw new Error('Invalid generated image')
    const url = optionalString(item.url, 3000)
    if (!/^https?:\/\//i.test(url)) throw new Error('Invalid generated image URL')

    return {
      id: optionalString(item.id, 80) || undefined,
      url,
      revisedPrompt: optionalString(item.revisedPrompt, 8000),
      sceneId: optionalString(item.sceneId, 80),
      sceneName: optionalString(item.sceneName, 120),
    }
  })
}

function validateClothingItems(value: unknown): ClothingItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMAGE_COUNT) {
    throw new Error('Invalid image list')
  }

  return value.map((item) => {
    if (!isRecord(item)) throw new Error('Invalid image item')
    const imageData = optionalString(item.imageData, MAX_DATA_URL_LENGTH)
    if (!isDataImage(imageData)) throw new Error('Invalid image data')

    return {
      imageData,
      fileName: optionalString(item.fileName, 255) || 'image',
      imageUrl: optionalString(item.imageUrl, 3000) || undefined,
    }
  })
}

function extractStoragePath(publicUrl: string | null) {
  if (!publicUrl) return null
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(publicUrl.slice(index + marker.length))
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(getClientKey(request, 'db'), 180, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) },
      }
    )
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON')
  }

  if (!body.action || !isRecord(body.payload || {})) {
    return errorResponse('Invalid database request')
  }

  const payload = body.payload || {}
  const supabase = createServiceSupabase()

  try {
    switch (body.action) {
      case 'createProject': {
        const name = getString(payload, 'name', 120)
        const { data, error } = await supabase
          .from('projects')
          .insert({ name, status: 'uploaded' })
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ data })
      }

      case 'getProject': {
        const id = getString(payload, 'id', 80)
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single()
        if (error) throw error
        return NextResponse.json({ data })
      }

      case 'updateProjectStatus': {
        const id = getString(payload, 'id', 80)
        const status = getString(payload, 'status', 40)
        if (!PROJECT_STATUSES.has(status)) throw new Error('Invalid status')
        const { data, error } = await supabase
          .from('projects')
          .update({ status })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ data })
      }

      case 'saveClothingItems': {
        const projectId = getString(payload, 'projectId', 80)
        const imageDataList = validateClothingItems(payload.imageDataList)
        const items = imageDataList.map(({ imageData, fileName, imageUrl }) => ({
          project_id: projectId,
          name: fileName.replace(/\.[^/.]+$/, ''),
          image_data: imageData,
          image_url: imageUrl || null,
          uploaded_at: new Date().toISOString().split('T')[0],
        }))
        const { data, error } = await supabase.from('clothing_items').insert(items).select()
        if (error) throw error
        return NextResponse.json({ data: data || [] })
      }

      case 'getClothingItems': {
        const projectId = getString(payload, 'projectId', 80)
        const { data, error } = await supabase
          .from('clothing_items')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return NextResponse.json({ data: data || [] })
      }

      case 'deleteClothingItem': {
        const id = getString(payload, 'id', 80)
        const { data: item, error: selectError } = await supabase
          .from('clothing_items')
          .select('image_url')
          .eq('id', id)
          .single()
        if (selectError) throw selectError

        const storagePath = extractStoragePath(item.image_url)
        if (storagePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
        }

        const { error } = await supabase.from('clothing_items').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ data: true })
      }

      case 'saveProductAnalysis': {
        const projectId = getString(payload, 'projectId', 80)
        const analysis = validateAnalysis(payload.analysis)
        const rawResponse = optionalString(payload.rawResponse, 20_000) || null
        const { data, error } = await supabase
          .from('product_analysis')
          .upsert({
            project_id: projectId,
            product_type: analysis.product_type,
            color: analysis.color,
            material: analysis.material,
            style: analysis.style,
            description: analysis.description,
            raw_response: rawResponse,
          }, { onConflict: 'project_id' })
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ data })
      }

      case 'getProductAnalysis': {
        const projectId = getString(payload, 'projectId', 80)
        const { data, error } = await supabase
          .from('product_analysis')
          .select('*')
          .eq('project_id', projectId)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        return NextResponse.json({ data: data || null })
      }

      case 'saveSceneConfigs': {
        const projectId = getString(payload, 'projectId', 80)
        const scenes = validateScenes(payload.scenes)
        const { error: deleteError } = await supabase
          .from('scene_configs')
          .delete()
          .eq('project_id', projectId)
        if (deleteError) throw deleteError

        const items = scenes.map((scene, index) => ({
          project_id: projectId,
          name: scene.name,
          sort_order: index,
          images_count: scene.imagesCount,
          season: scene.season,
          subject: scene.subject,
          environment: scene.environment,
          surroundings: scene.surroundings,
          custom_prompt: scene.customPrompt,
          preset_id: scene.preset_id || null,
        }))

        const { data, error } = await supabase.from('scene_configs').insert(items).select()
        if (error) throw error
        return NextResponse.json({ data: data || [] })
      }

      case 'getSceneConfigs': {
        const projectId = getString(payload, 'projectId', 80)
        const { data, error } = await supabase
          .from('scene_configs')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
        if (error) throw error
        return NextResponse.json({ data: data || [] })
      }

      case 'saveGeneratedImages': {
        const projectId = getString(payload, 'projectId', 80)
        const images = validateGeneratedImages(payload.images)
        const items = images.map(img => ({
          project_id: projectId,
          scene_config_id: img.sceneId.startsWith('scene_') ? null : img.sceneId || null,
          url: img.url,
          revised_prompt: img.revisedPrompt,
          scene_name: img.sceneName,
        }))
        const { data, error } = await supabase.from('generated_images').insert(items).select()
        if (error) throw error
        return NextResponse.json({ data: data || [] })
      }

      case 'getGeneratedImages': {
        const projectId = getString(payload, 'projectId', 80)
        const { data, error } = await supabase
          .from('generated_images')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return NextResponse.json({ data: data || [] })
      }

      case 'deleteGeneratedImage': {
        const id = getString(payload, 'id', 80)
        const { error } = await supabase.from('generated_images').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ data: true })
      }

      case 'saveSelectedImages': {
        const projectId = getString(payload, 'projectId', 80)
        const selectedImageIds = Array.isArray(payload.selectedImageIds)
          ? payload.selectedImageIds.filter((id): id is string => typeof id === 'string').slice(0, 100)
          : []
        const coverImageId = typeof payload.coverImageId === 'string' ? payload.coverImageId : null
        const caption = optionalString(payload.caption, 10_000)
        const { data, error } = await supabase
          .from('selected_images')
          .upsert({
            project_id: projectId,
            selected_image_ids: selectedImageIds,
            cover_image_id: coverImageId,
            caption,
          })
          .select()
          .single()
        if (error) throw error
        return NextResponse.json({ data })
      }

      case 'getSelectedImages': {
        const projectId = getString(payload, 'projectId', 80)
        const { data, error } = await supabase
          .from('selected_images')
          .select('*')
          .eq('project_id', projectId)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        return NextResponse.json({ data: data || null })
      }

      default:
        return errorResponse('Unknown database action', 404)
    }
  } catch (error) {
    console.error('Database API error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Database operation failed', 500)
  }
}
