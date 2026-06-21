export interface ClothingImage {
  id: string
  url: string
  file_name: string
  uploaded_at: string
  status: 'pending' | 'generating' | 'generated' | 'reviewed'
}

export interface GeneratedImage {
  id: string
  clothing_image_id: string
  url: string
  prompt: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface SocialAccount {
  id: string
  platform: 'facebook' | 'instagram'
  account_name: string
  account_id: string
  access_token: string
}
