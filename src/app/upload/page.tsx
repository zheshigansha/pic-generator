'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'
import { useProject } from '@/components/ProjectContext'
import {
  saveClothingItems,
  getClothingItemsWithAnalysis,
  deleteClothingItem,
  updateClothingItemProcessedImage,
} from '@/lib/db'
import { uploadToStorage } from '@/lib/supabase'

import type { ProductAnalysis } from '@/lib/database.types'

const MAX_IMAGES = 20
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

interface UploadedItem {
  id: string
  name: string
  image_data: string
  image_url: string | null
  processed_image_data?: string
  processed_image_url?: string | null
  uploaded_at: string
  analysis?: ProductAnalysis
}

export default function UploadPage() {
  const { project } = useProject()
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadedItems, setUploadedItems] = useState<UploadedItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadItems = async () => {
      if (!project) return
      try {
        const items = await getClothingItemsWithAnalysis(project.id)
        setUploadedItems(items)
      } catch (e) {
        console.error('Failed to load items:', e)
      }
    }
    loadItems()
  }, [project])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const validFiles = Array.from(selectedFiles).filter(file => {
      if (!ALLOWED_TYPES.has(file.type)) {
        alert(`${file.name} 不是支持的图片格式`)
        return false
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} 超过 10MB`)
        return false
      }
      return true
    })

    const replaceIndex = e.target.dataset.replaceIndex
    if (replaceIndex !== undefined && validFiles[0]) {
      const index = Number(replaceIndex)
      setFiles(prev => {
        const next = [...prev]
        if (next[index]) URL.revokeObjectURL(next[index].preview)
        next[index] = { file: validFiles[0], preview: URL.createObjectURL(validFiles[0]) }
        return next
      })
      delete e.target.dataset.replaceIndex
      e.target.value = ''
      return
    }

    const newFiles = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    setFiles(prev => {
      const combined = [...prev, ...newFiles]
      if (combined.length > MAX_IMAGES) {
        combined.slice(MAX_IMAGES).forEach(item => URL.revokeObjectURL(item.preview))
        return combined.slice(0, MAX_IMAGES)
      }
      return combined
    })
    e.target.value = ''
  }, [])

  const removeFile = (index: number) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const replaceFile = (index: number) => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
      fileInputRef.current.dataset.replaceIndex = String(index)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0 || !project) return

    setUploading(true)

    try {
      const imageDataList = await Promise.all(
        files.map(async ({ file, preview }) => {
          const response = await fetch(preview)
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })

          const imagePath = `${project.id}/${Date.now()}_${file.name}`
          let imageUrl: string | undefined
          try {
            imageUrl = await uploadToStorage('clothing-images', file, imagePath)
          } catch (e) {
            console.warn('Storage upload failed, continuing without URL:', e)
          }

          return {
            imageData: base64,
            fileName: file.name,
            imageUrl,
          }
        })
      )

      await saveClothingItems(project.id, imageDataList)
      alert(`上传成功 ${files.length} 张图片！正在去除背景...`)
      files.forEach(item => URL.revokeObjectURL(item.preview))
      setFiles([])

      const items = await getClothingItemsWithAnalysis(project.id)

      const itemsWithBg: UploadedItem[] = []
      for (const item of items) {
        try {
          const resp = await fetch('/api/remove-bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: item.image_data,
              projectId: project.id,
              itemId: item.id,
            }),
          })
          if (resp.ok) {
            const data = await resp.json()
            if (data.processedImageUrl) {
              await updateClothingItemProcessedImage(item.id, data.processedImageUrl)
            }
            itemsWithBg.push({
              ...item,
              processed_image_data: data.processedImageData,
              processed_image_url: data.processedImageUrl ?? null,
            })
          } else {
            console.warn('Background removal failed for item', item.id, resp.status)
            itemsWithBg.push(item as UploadedItem)
          }
        } catch (e) {
          console.warn('Background removal error for item', item.id, e)
          itemsWithBg.push(item as UploadedItem)
        }
      }

      setUploadedItems(itemsWithBg)
    } catch (error) {
      console.error('Upload error:', error)
      alert('上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这张图片吗？')) return
    try {
      await deleteClothingItem(id)
      setUploadedItems(prev => prev.filter(item => item.id !== id))
    } catch (e) {
      console.error('Delete error:', e)
      alert('删除失败')
    }
  }

  const uploadedCount = uploadedItems.length
  const hasEnoughForAnalysis = uploadedCount > 0

  return (
    <WizardLayout currentStep={1}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">上传图片</h1>
          <p className="text-gray-400 mt-1">上传同一产品的不同角度图片（最多 {MAX_IMAGES} 张）</p>
        </div>

        <div className="mb-8">
          <div className="border-2 border-dashed border-gray-600 rounded-2xl p-8 text-center hover:border-blue-500 transition-colors relative">
            <input
              type="file"
              id="file-upload"
              ref={fileInputRef}
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
                <span className="text-3xl">📷</span>
              </div>
              <div>
                <p className="text-lg font-medium">点击上传或拖拽图片</p>
                <p className="text-sm text-gray-400 mt-1">PNG, JPG, WEBP，单张最大 10MB</p>
              </div>
            </label>

            <div className="absolute top-4 right-4 bg-gray-700 px-3 py-1 rounded-full text-sm text-gray-300">
              {files.length} / {MAX_IMAGES}
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">待上传图片（{files.length}张）</h3>
                <button
                  onClick={() => {
                    files.forEach(item => URL.revokeObjectURL(item.preview))
                    setFiles([])
                  }}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  清空全部
                </button>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {files.map((item, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={item.preview}
                      alt={`预览 ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg border border-gray-600"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                      <button
                        onClick={() => replaceFile(index)}
                        className="w-8 h-8 bg-blue-600 rounded-full text-white text-sm hover:bg-blue-700"
                        title="替换"
                      >
                        ↻
                      </button>
                      <button
                        onClick={() => removeFile(index)}
                        className="w-8 h-8 bg-red-600 rounded-full text-white text-sm hover:bg-red-700"
                        title="删除"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 truncate">{item.file.name}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
                className={`mt-6 px-8 py-3 rounded-lg font-medium transition-colors ${
                  files.length === 0 || uploading
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {uploading ? '上传中...' : `上传 ${files.length} 张图片`}
              </button>
            </div>
          )}
        </div>

        {uploadedCount > 0 && <div className="border-t border-gray-700 mb-8" />}

        {uploadedCount > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">已上传图片（{uploadedCount}张）</h2>
              <button
                onClick={async () => {
                  if (!project) return
                  const items = await getClothingItemsWithAnalysis(project.id)
                  setUploadedItems(items)
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                ↻ 刷新
              </button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {uploadedItems.map((item) => (
                <div key={item.id} className="relative group">
                  <img
                    src={item.image_data}
                    alt={item.name}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-600"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-8 h-8 bg-red-600 rounded-full text-white text-sm hover:bg-red-700"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                  {item.analysis && (
                    <div className="absolute bottom-2 left-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded text-center">
                      ✓ 已分析
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasEnoughForAnalysis && (
          <div className="mt-8 text-center">
            <Link
              href="/analysis"
              className="inline-block bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg font-medium transition-colors"
            >
              继续：产品分析 →
            </Link>
          </div>
        )}
      </div>
    </WizardLayout>
  )
}
