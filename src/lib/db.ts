import type { Database, ProductAnalysis, SceneConfig, GeneratedImage } from './database.types'

type ProjectRow = Database['public']['Tables']['projects']['Row']
type ClothingItemRow = Database['public']['Tables']['clothing_items']['Row']
type ProductAnalysisRow = Database['public']['Tables']['product_analysis']['Row']
type SelectedImagesRow = Database['public']['Tables']['selected_images']['Row']
type ClothingItemWithAnalysis = ClothingItemRow & { analysis?: ProductAnalysis }

async function dbRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Database request failed: ${action}`)
  }

  return data.data as T
}

// ============================================================================
// PROJECT OPERATIONS
// ============================================================================

export async function createProject(name: string) {
  return dbRequest<ProjectRow>('createProject', { name })
}

export async function getProject(id: string) {
  return dbRequest<ProjectRow>('getProject', { id })
}

export async function updateProjectStatus(id: string, status: string) {
  return dbRequest<ProjectRow>('updateProjectStatus', { id, status })
}

// ============================================================================
// CLOTHING ITEMS OPERATIONS
// ============================================================================

export async function saveClothingItems(
  projectId: string,
  imageDataList: Array<{ imageData: string; fileName: string; imageUrl?: string }>
) {
  return dbRequest<ClothingItemRow[]>('saveClothingItems', { projectId, imageDataList })
}

export async function getClothingItems(projectId: string) {
  return dbRequest<ClothingItemRow[]>('getClothingItems', { projectId })
}

export async function getClothingItemsWithAnalysis(projectId: string) {
  const [items, analysis] = await Promise.all([
    getClothingItems(projectId),
    getProductAnalysis(projectId),
  ])

  // Attach analysis to each item (analysis is project-level, same for all items)
  const normalizedAnalysis = analysis
    ? {
        product_type: analysis.product_type || '',
        color: analysis.color || '',
        material: analysis.material || '',
        style: analysis.style || '',
        description: analysis.description || '',
      }
    : undefined

  return items.map<ClothingItemWithAnalysis>(item => ({
    ...item,
    analysis: normalizedAnalysis,
  }))
}

export async function deleteClothingItem(id: string) {
  return dbRequest('deleteClothingItem', { id })
}

// ============================================================================
// PRODUCT ANALYSIS OPERATIONS
// ============================================================================

export async function saveProductAnalysis(projectId: string, analysis: ProductAnalysis, rawResponse?: string) {
  return dbRequest<ProductAnalysisRow>('saveProductAnalysis', { projectId, analysis, rawResponse })
}

export async function getProductAnalysis(projectId: string) {
  return dbRequest<ProductAnalysisRow | null>('getProductAnalysis', { projectId })
}

// ============================================================================
// SCENE CONFIGS OPERATIONS
// ============================================================================

export async function saveSceneConfigs(projectId: string, scenes: SceneConfig[]) {
  return dbRequest<DbScene[]>('saveSceneConfigs', { projectId, scenes })
}

export async function getSceneConfigs(projectId: string) {
  const data = await dbRequest<DbScene[]>('getSceneConfigs', { projectId })
  return data.map(mapDbSceneToSceneConfig)
}

// ============================================================================
// GENERATED IMAGES OPERATIONS
// ============================================================================

export async function saveGeneratedImages(projectId: string, images: GeneratedImage[]) {
  return dbRequest<DbGeneratedImage[]>('saveGeneratedImages', { projectId, images })
}

export async function getGeneratedImages(projectId: string) {
  const data = await dbRequest<DbGeneratedImage[]>('getGeneratedImages', { projectId })
  return data.map(mapDbImageToGeneratedImage)
}

export async function deleteGeneratedImage(id: string) {
  return dbRequest<boolean>('deleteGeneratedImage', { id })
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
  return dbRequest<SelectedImagesRow>('saveSelectedImages', { projectId, selectedImageIds, coverImageId, caption })
}

export async function getSelectedImages(projectId: string) {
  return dbRequest<SelectedImagesRow | null>('getSelectedImages', { projectId })
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

interface DbScene {
  id: string
  name: string
  images_count: number
  season: string
  subject: string
  environment: string
  surroundings: string[] | null
  custom_prompt: string | null
  preset_id: string | null
}

interface DbGeneratedImage {
  id: string
  url: string
  revised_prompt: string | null
  scene_config_id: string | null
  scene_name: string | null
}

function mapDbSceneToSceneConfig(dbScene: DbScene): SceneConfig {
  return {
    id: dbScene.id,
    name: dbScene.name,
    imagesCount: dbScene.images_count,
    season: dbScene.season,
    subject: dbScene.subject,
    environment: dbScene.environment,
    surroundings: dbScene.surroundings || [],
    customPrompt: dbScene.custom_prompt || '',
    preset_id: dbScene.preset_id || undefined,
  }
}

function mapDbImageToGeneratedImage(dbImage: DbGeneratedImage): GeneratedImage {
  return {
    id: dbImage.id,
    url: dbImage.url,
    revisedPrompt: dbImage.revised_prompt || '',
    sceneId: dbImage.scene_config_id || '',
    sceneName: dbImage.scene_name || '',
  }
}
