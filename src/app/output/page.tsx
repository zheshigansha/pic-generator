'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'

interface GeneratedImage {
  url: string
  revisedPrompt: string
  sceneId: string
  sceneName: string
}

const GENERATED_STORAGE_KEY = 'visionfit_generated_images'
const SELECTED_STORAGE_KEY = 'visionfit_selected_images'

export default function OutputPage() {
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [coverIndex, setCoverIndex] = useState<number | null>(null)
  const [caption, setCaption] = useState('')
  const [platform, setPlatform] = useState<'facebook' | 'instagram' | 'download' | null>(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    const savedImages = localStorage.getItem(GENERATED_STORAGE_KEY)
    const savedSelection = localStorage.getItem(SELECTED_STORAGE_KEY)

    if (savedImages) {
      setImages(JSON.parse(savedImages))
    }

    if (savedSelection) {
      const { ids, coverIndex: ci } = JSON.parse(savedSelection)
      setSelectedIds(ids)
      setCoverIndex(ci)
    }
  }, [])

  const selectedImages = selectedIds.map(id => images[id]).filter(Boolean)
  const coverImage = coverIndex !== null ? images[coverIndex] : selectedImages[0]

  const handlePublish = async () => {
    if (!platform || platform === 'download') return

    setPublishing(true)

    // Simulate publish - in real implementation, call Facebook/Instagram API
    await new Promise(resolve => setTimeout(resolve, 2000))

    setPublishing(false)
    alert(`${platform === 'facebook' ? 'Facebook' : 'Instagram'} 发布功能开发中...`)
  }

  const handleDownload = () => {
    // Create a simple text file with image URLs
    const content = `VisionFit Pro - 图片输出\n${new Date().toLocaleDateString()}\n\n封面图:\n${coverImage?.url || '未设置'}\n\n选中图片:\n${selectedImages.map((img, i) => `${i + 1}. ${img.sceneName}\n   ${img.url}`).join('\n\n')}\n\n文案:\n${caption}`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `visionfit-output-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
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
              <p className="text-xs text-gray-500 mt-2">
                建议包含产品特点和场景描述
              </p>
            </div>

            {/* Cover Options */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">封面选项</h2>
              <div className="space-y-2">
                <button className="w-full p-3 rounded-lg border-2 border-blue-500 bg-blue-500/20 text-left text-sm">
                  <span className="text-blue-400">✓</span> 使用已选封面
                </button>
                <button
                  disabled
                  className="w-full p-3 rounded-lg border border-gray-700 text-left text-sm text-gray-500 cursor-not-allowed"
                >
                  重新生成封面（开发中）
                </button>
                <button
                  disabled
                  className="w-full p-3 rounded-lg border border-gray-700 text-left text-sm text-gray-500 cursor-not-allowed"
                >
                  上传自定义封面（开发中）
                </button>
              </div>
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
              disabled={!platform || publishing}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                !platform || publishing
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {publishing ? '处理中...' : platform === 'download' ? '下载' : '发布'}
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