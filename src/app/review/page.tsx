'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'
import { useProject } from '@/components/ProjectContext'
import {
  getGeneratedImages,
  getSelectedImages,
  saveSelectedImages,
  deleteGeneratedImage,
} from '@/lib/db'
import type { GeneratedImage } from '@/lib/database.types'

export default function ReviewPage() {
  const { project } = useProject()
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [coverId, setCoverId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!project) return
      try {
        const [loadedImages, savedSelection] = await Promise.all([
          getGeneratedImages(project.id),
          getSelectedImages(project.id),
        ])
        setImages(loadedImages)

        if (savedSelection) {
          setSelectedIds(new Set(savedSelection.selected_image_ids || []))
          setCoverId(savedSelection.cover_image_id || null)
        }
      } catch (e) {
        console.error('Failed to load data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [project])

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const setAsCover = (id: string) => {
    setCoverId(id)
    if (!selectedIds.has(id)) {
      const newSelected = new Set(selectedIds)
      newSelected.add(id)
      setSelectedIds(newSelected)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这张图片吗？')) return
    try {
      await deleteGeneratedImage(id)
      setImages(prev => prev.filter(img => img.id !== id))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (coverId === id) setCoverId(null)
    } catch (e) {
      console.error('Delete error:', e)
      alert('删除失败')
    }
  }

  const handleSave = async () => {
    if (!project) return
    setSaving(true)
    try {
      const caption = '' // User fills this in output page
      await saveSelectedImages(
        project.id,
        Array.from(selectedIds),
        coverId,
        caption
      )
      alert('选择已保存！')
    } catch (e) {
      console.error('Save error:', e)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // Group images by scene
  const groupedImages: { [sceneName: string]: GeneratedImage[] } = {}
  images.forEach(img => {
    const key = img.sceneName || '未命名'
    if (!groupedImages[key]) {
      groupedImages[key] = []
    }
    groupedImages[key].push(img)
  })

  if (!project || loading) {
    return (
      <WizardLayout currentStep={5}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400">加载中...</p>
        </div>
      </WizardLayout>
    )
  }

  if (images.length === 0) {
    return (
      <WizardLayout currentStep={5}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400 mb-4">还没有生成的图片</p>
          <Link href="/generate" className="text-blue-400 hover:text-blue-300">
            ← 返回生成
          </Link>
        </div>
      </WizardLayout>
    )
  }

  return (
    <WizardLayout currentStep={5}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">审核与发布</h1>
          <p className="text-gray-400 mt-1">选择要保留的图片，设定封面</p>
        </div>

        {/* Actions Bar */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              已选择 <span className="text-white font-medium">{selectedIds.size}</span> / {images.length} 张
            </span>
            {coverId && (
              <span className="text-sm text-green-400">封面已设置</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || selectedIds.size === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              saving ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? '保存中...' : '💾 保存选择'}
          </button>
        </div>

        {/* Images by Scene */}
        <div className="space-y-8">
          {Object.entries(groupedImages).map(([sceneName, sceneImages]) => (
            <div key={sceneName}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                {sceneName}
                <span className="text-sm text-gray-500 font-normal">({sceneImages.length}张)</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sceneImages.map((img) => {
                  const isSelected = selectedIds.has(img.id || '')
                  const isCover = coverId === (img.id || '')

                  return (
                    <div
                      key={img.id}
                      className={`relative rounded-lg border-2 transition-all overflow-hidden ${
                        isCover
                          ? 'border-green-500 ring-2 ring-green-500/50'
                          : isSelected
                          ? 'border-blue-500'
                          : 'border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.sceneName}
                        className="w-full aspect-[3/4] object-cover"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleSelect(img.id || '')}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </button>
                        <button
                          onClick={() => setAsCover(img.id || '')}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isCover
                              ? 'bg-green-600 text-white'
                              : 'bg-white/20 text-white hover:bg-green-600'
                          }`}
                          title="设为封面"
                        >
                          ★
                        </button>
                        <button
                          onClick={() => handleDelete(img.id || '')}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-red-600 transition-colors"
                          title="删除"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Cover Badge */}
                      {isCover && (
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded font-medium">
                          封面
                        </div>
                      )}

                      {/* Selected Badge */}
                      {isSelected && !isCover && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Link href="/generate" className="text-gray-400 hover:text-white transition-colors">
            ← 返回生成
          </Link>
          <Link
            href="/output"
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            继续：输出发布 →
          </Link>
        </div>
      </div>
    </WizardLayout>
  )
}
