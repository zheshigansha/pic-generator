// Shared types used across multiple components/pages
// These supplement the types in lib/database.types.ts

export interface ClothingItemDB {
  id: string
  name: string
  image_data: string
  image_url: string | null
  uploaded_at: string
  analysis?: {
    product_type: string
    color: string
    material: string
    style: string
    description: string
  }
}

export interface SceneConfigUI {
  id: string
  name: string
  imagesCount: number
  season: string
  subject: string
  environment: string
  surroundings: string[]
  customPrompt: string
}
