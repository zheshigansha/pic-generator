// LocalStorage keys
const STORAGE_KEYS = {
  CLOTHING_ITEMS: 'visionfit_clothing_items',
} as const

export interface ProductAnalysis {
  product_type: string
  color_main: string
  color_main_hex: string   // hex like "#1A1A1A"
  color_accents: string
  color_accents_hex: string  // hex like "#FFFFFF"
  material_texture: string
  logo_position: string
  logo_style: string
  special_features: string[]
  silhouette: string
  description: string
}

export interface ClothingItem {
  id: string
  name: string
  imageData: string // Base64 data URL
  uploaded_at: string
  analysis?: ProductAnalysis
}

// Save clothing item to localStorage
export function saveClothingItem(imageData: string, fileName: string): ClothingItem {
  const items = getClothingItems()

  const newItem: ClothingItem = {
    id: `clothing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: fileName.replace(/\.[^/.]+$/, ''), // Remove extension from filename
    imageData,
    uploaded_at: new Date().toISOString().split('T')[0],
  }

  items.unshift(newItem) // Add to beginning
  localStorage.setItem(STORAGE_KEYS.CLOTHING_ITEMS, JSON.stringify(items))

  return newItem
}

// Get all clothing items from localStorage
export function getClothingItems(): ClothingItem[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem(STORAGE_KEYS.CLOTHING_ITEMS)
  if (!stored) return []

  try {
    return JSON.parse(stored)
  } catch {
    return []
  }
}

// Update item with analysis data
export function updateItemAnalysis(id: string, analysis: ProductAnalysis): void {
  const items = getClothingItems()
  const updated = items.map(item =>
    item.id === id ? { ...item, analysis } : item
  )
  localStorage.setItem(STORAGE_KEYS.CLOTHING_ITEMS, JSON.stringify(updated))
}

// Delete a clothing item
export function deleteClothingItem(id: string): void {
  const items = getClothingItems()
  const filtered = items.filter(item => item.id !== id)
  localStorage.setItem(STORAGE_KEYS.CLOTHING_ITEMS, JSON.stringify(filtered))
}

// Clear all clothing items
export function clearClothingItems(): void {
  localStorage.removeItem(STORAGE_KEYS.CLOTHING_ITEMS)
}