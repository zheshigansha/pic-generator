'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'
import { useProject } from '@/components/ProjectContext'
import {
  getGeneratedImages,
  getSelectedImages,
  saveSelectedImages,
} from '@/lib/db'
import type { GeneratedImage } from '@/lib/database.types'

export default function OutputPage() {
  const { project } = useProject()
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [coverId, setCoverId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'download' | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [loading, setLoading] = useState(true)

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
          setSelectedIds(savedSelection.selected_image_ids || [])
          setCoverId(savedSelection.cover_image_id || null)
          setCaption(savedSelection.caption || '')
        }
      } catch (e) {
        console.error('Failed to load data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [project])

  const selectedImages = selectedIds
    .map(id => images.find(img => img.id === id))
    .filter((img): img is GeneratedImage => img !== undefined)

  const coverImage = coverId
    ? images.find(img => img.id === coverId)
    : selectedImages[0]

  const handleSaveCaption = async () => {
    if (!project) return
    try {
      await saveSelectedImages(project.id, selectedIds, coverId, caption)
      alert('文案已保存')
    } catch (e) {
      console.error('Failed to save caption:', e)
      alert('保存失败')
    }
  }

  const handlePublish = async () => {
    if (!platform || platform === 'download') return
    if (selectedIds.length === 0) {
      alert('请先选择要发布的图片')
      return
    }

    setPublishing(true)
    // Simulate publish - in real implementation, call Facebook/Instagram API
    await new Promise(resolve => setTimeout(resolve, 2000))
    setPublishing(false)
    alert(`${platform === 'facebook' ? 'Facebook' : 'Instagram'} 发布功能开发中...`)
  }

  const handleDownload = () => {
    if (selectedImages.length === 0) {
      alert('请先选择要下载的图片')
      return
    }

    // Create a simple text file with image URLs and caption
    const content = `VisionFit Pro - 图片输出\n${new Date().toLocaleDateString()}\n\n封面图:\n${coverImage?.url || '未设置'}\n\n选中图片:\n${selectedImages.map((img, i) => `${i + 1}. ${img.sceneName}\n   ${img.url}`).join('\n\n')}\n\n文案:\n${caption}`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'visionfit-output.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

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
          <p className="text-gray-400 mb-4">请先生成图片</p>
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
          <h1 className="text-2xl font-bold text-white">输出与发布</h1>
          <p className="text-gray-400 mt-1">选择发布平台，生成文案，准备发布</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Preview */}
          <div className="col-span-8">
            {/* Cover Image */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                封面图片
              </h2>
              {coverImage ? (
                <div className="flex gap-6">
                  <img
                    src={coverImage.url}
                    alt="封面"
                    className="w-64 aspect-[3/4] object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-gray-400 mb-2">场景: {coverImage.sceneName}</p>
                    <p className="text-sm text-gray-300 mb-4">提示词:</p>
                    <p className="text-xs text-gray-500 bg-gray-900 rounded p-3 max-h-40 overflow-y-auto">
                      {coverImage.revisedPrompt}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">未设置封面</p>
              )}
            </div>

            {/* Selected Images */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4">
                已选图片 ({selectedImages.length}张)
              </h2>
              {selectedImages.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={img.url}
                        alt={img.sceneName}
                        className="w-full aspect-[3/4] object-cover rounded"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                        {img.sceneName}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">请在审核页面选择图片</p>
              )}
            </div>
          </div>

          {/* Right: Settings */}
          <div className="col-span-4">
            {/* Caption */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">文案内容</h2>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="输入发布文案..."
                className="w-full h-40 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveCaption}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  保存文案
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                建议包含产品特点和场景描述
              </p>
            </div>

            {/* Publish Platform */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">发布平台</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setPlatform('facebook')}
                  className={`w-full p-3 rounded-lg border-2 text-left flex items-center gap-3 transition-colors ${
                    platform === 'facebook'
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span className="text-2xl">📘</span>
                  <div>
                    <p className="font-medium">Facebook</p>
                    <p className="text-xs text-gray-500">发布到 Facebook 主页</p>
                  </div>
                </button>
                <button
                  onClick={() => setPlatform('instagram')}
                  className={`w-full p-3 rounded-lg border-2 text-left flex items-center gap-3 transition-colors ${
                    platform === 'instagram'
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span className="text-2xl">📷</span>
                  <div>
                    <p className="font-medium">Instagram</p>
                    <p className="text-xs text-gray-500">发布到 Instagram</p>
                  </div>
                </button>
                <button
                  onClick={() => setPlatform('download')}
                  className={`w-full p-3 rounded-lg border-2 text-left flex items-center gap-3 transition-colors ${
                    platform === 'download'
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span className="text-2xl">💾</span>
                  <div>
                    <p className="font-medium">下载到本地</p>
                    <p className="text-xs text-gray-500">下载图片和文案</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={platform === 'download' ? handleDownload : handlePublish}
              disabled={!platform || publishing || selectedImages.length === 0}
              className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                !platform || publishing || selectedImages.length === 0
                  ? 'bg-gray-700 text-gray-400'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {publishing ? '处理中...' : platform === 'download' ? '💾 下载' : '📤 发布'}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              Facebook/Instagram API 集成开发中
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Link href="/review" className="text-gray-400 hover:text-white transition-colors">
            ← 返回审核
          </Link>
        </div>
      </div>
    </WizardLayout>
  )
}
