// Database types matching the Supabase schema
// Auto-generated from supabase/migrations/001_initial_schema.sql

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          status: 'uploaded' | 'analyzed' | 'scene_set' | 'generated' | 'reviewed' | 'published'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      clothing_items: {
        Row: {
          id: string
          project_id: string
          name: string
          image_data: string
          uploaded_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['clothing_items']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['clothing_items']['Insert']>
      }
      product_analysis: {
        Row: {
          id: string
          project_id: string
          product_type: string | null
          color: string | null
          material: string | null
          style: string | null
          description: string | null
          raw_response: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_analysis']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['product_analysis']['Insert']>
      }
      scene_configs: {
        Row: {
          id: string
          project_id: string
          name: string
          sort_order: number
          images_count: number
          season: string
          subject: string
          environment: string
          surroundings: string[]
          custom_prompt: string
          preset_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['scene_configs']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['scene_configs']['Insert']>
      }
      generated_images: {
        Row: {
          id: string
          project_id: string
          scene_config_id: string | null
          url: string
          revised_prompt: string | null
          scene_name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['generated_images']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['generated_images']['Insert']>
      }
      selected_images: {
        Row: {
          id: string
          project_id: string
          selected_image_ids: string[]
          cover_image_id: string | null
          caption: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['selected_images']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['selected_images']['Insert']>
      }
    }
  }
}

// Re-export ProductAnalysis from storage for compatibility
export interface ProductAnalysis {
  product_type: string
  color: string
  material: string
  style: string
  description: string
}

// SceneConfig from scene page
export interface SceneConfig {
  id: string
  name: string
  imagesCount: number
  season: string
  subject: string
  environment: string
  surroundings: string[]
  customPrompt: string
  preset_id?: string
}

// GeneratedImage from generate page
export interface GeneratedImage {
  id?: string
  url: string
  revisedPrompt: string
  sceneId: string
  sceneName: string
}