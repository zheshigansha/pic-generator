import { supabase } from './supabase'
import type { ProductAnalysis, SceneConfig, GeneratedImage } from './database.types'

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

export async function createProject(name: string) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, status: 'uploaded' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getProject(id: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateProjectStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('projects')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================================
// CLOTHING ITEMS OPERATIONS
// ============================================================================

export async function saveClothingItems(projectId: string, imageDataList: Array<{ imageData: string; fileName: string }>) {
  const items = imageDataList.map(({ imageData, fileName }) => ({
    project_id: projectId,
    name: fileName.replace(/\.[^/.]+$/, ''),
    image_data: imageData,
    uploaded_at: new Date().toISOString().split('T')[0],
  }))

  const { data, error } = await supabase
    .from('clothing_items')
    .insert(items)
    .select()

  if (error) throw error
  return data
}

export async function getClothingItems(projectId: string) {
  const { data, error } = await supabase
    .from('clothing_items')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getClothingItemsWithAnalysis(projectId: string) {
  const [items, analysis] = await Promise.all([
    getClothingItems(projectId),
    getProductAnalysis(projectId),
  ])

  // Attach analysis to each item (analysis is project-level, same for all items)
  return items.map(item => ({
    ...item,
    analysis: analysis || undefined,
  }))
}

export async function deleteClothingItem(id: string) {
  const { error } = await supabase
    .from('clothing_items')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================================================
// PRODUCT ANALYSIS OPERATIONS
// ============================================================================

export async function saveProductAnalysis(projectId: string, analysis: ProductAnalysis, rawResponse?: string) {
  const { data, error } = await supabase
    .from('product_analysis')
    .upsert({
      project_id: projectId,
      product_type: analysis.product_type,
      color: analysis.color,
      material: analysis.material,
      style: analysis.style,
      description: analysis.description,
      raw_response: rawResponse || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getProductAnalysis(projectId: string) {
  const { data, error } = await supabase
    .from('product_analysis')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows found
  return data || null
}

// ============================================================================
// SCENE CONFIGS OPERATIONS
// ============================================================================

export async function saveSceneConfigs(projectId: string, scenes: SceneConfig[]) {
  // Delete existing scenes and insert new ones
  const { error: deleteError } = await supabase
    .from('scene_configs')
    .delete()
    .eq('project_id', projectId)

  if (deleteError) throw deleteError

  if (scenes.length === 0) return []

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
    preset_id: (scene as any).preset_id || null,
  }))

  const { data, error } = await supabase
    .from('scene_configs')
    .insert(items)
    .select()

  if (error) throw error
  return data || []
}

export async function getSceneConfigs(projectId: string) {
  const { data, error } = await supabase
    .from('scene_configs')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data || []).map(mapDbSceneToSceneConfig)
}

// ============================================================================
// GENERATED IMAGES OPERATIONS
// ============================================================================

export async function saveGeneratedImages(projectId: string, images: GeneratedImage[]) {
  const items = images.map(img => ({
    project_id: projectId,
    scene_config_id: img.sceneId.startsWith('scene_') ? null : img.sceneId,
    url: img.url,
    revised_prompt: img.revisedPrompt,
    scene_name: img.sceneName,
  }))

  const { data, error } = await supabase
    .from('generated_images')
    .insert(items)
    .select()

  if (error) throw error
  return data || []
}

export async function getGeneratedImages(projectId: string) {
  const { data, error } = await supabase
    .from('generated_images')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map(mapDbImageToGeneratedImage)
}

export async function deleteGeneratedImage(id: string) {
  const { error } = await supabase
    .from('generated_images')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================================================
// SELECTED IMAGES OPERATIONS
// ============================================================================

export async function saveSelectedImages(
  projectId: string,
  selectedImageIds: string[],
  coverImageId: string | null,
  caption: string
) {
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
  return data
}

export async function getSelectedImages(projectId: string) {
  const { data, error } = await supabase
    .from('selected_images')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function mapDbSceneToSceneConfig(dbScene: any): SceneConfig {
  return {
    id: dbScene.id,
    name: dbScene.name,
    imagesCount: dbScene.images_count,
    season: dbScene.season,
    subject: dbScene.subject,
    environment: dbScene.environment,
    surroundings: dbScene.surroundings || [],
    customPrompt: dbScene.custom_prompt || '',
    preset_id: dbScene.preset_id,
  }
}

function mapDbImageToGeneratedImage(dbImage: any): GeneratedImage {
  return {
    id: dbImage.id,
    url: dbImage.url,
    revisedPrompt: dbImage.revised_prompt || '',
    sceneId: dbImage.scene_config_id || '',
    sceneName: dbImage.scene_name || '',
  }
}