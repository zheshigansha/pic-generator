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

export default function ReviewPage() {
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [coverIndex, setCoverIndex] = useState<number | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(GENERATED_STORAGE_KEY)
    if (saved) {
      setImages(JSON.parse(saved))
    }

    const selected = localStorage.getItem(SELECTED_STORAGE_KEY)
    if (selected) {
      const { ids, coverIndex: ci } = JSON.parse(selected)
      setSelectedIds(new Set(ids))
      setCoverIndex(ci)
    }
  }, [])

  const toggleSelect = (index: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedIds(newSelected)
  }

  const setAsCover = (index: number) => {
    setCoverIndex(index)
    if (!selectedIds.has(index)) {
      const newSelected = new Set(selectedIds)
      newSelected.add(index)
      setSelectedIds(newSelected)
    }
  }

  const deleteSelected = () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 张图片吗？`)) return

    const remaining = images.filter((_, i) => !selectedIds.has(i))
    setImages(remaining)
    setSelectedIds(new Set())
    if (coverIndex !== null && selectedIds.has(coverIndex)) {
      setCoverIndex(null)
    }
    localStorage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(remaining))
  }

  const saveSelection = () => {
    localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify({
      ids: Array.from(selectedIds),
      coverIndex,
    }))
    alert('选择已保存！')
  }

  // Group images by scene
  const groupedImages: { [sceneName: string]: GeneratedImage[] } = {}
  images.forEach((img, idx) => {
    const key = img.sceneName || '未命名'
    if (!groupedImages[key]) {
      groupedImages[key] = []
    }
    groupedImages[key].push({ ...img, url: img.url })
  })

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
            {coverIndex !== null && (
              <span className="text-sm text-green-400">
                封面已设置
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={deleteSelected}
              disabled={selectedIds.size === 0}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedIds.size === 0
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              删除选中
            </button>
            <button
              onClick={saveSelection}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              保存选择
            </button>
          </div>
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
                {sceneImages.map((img, idx) => {
                  const globalIndex = images.indexOf(img)
                  const isSelected = selectedIds.has(globalIndex)
                  const isCover = coverIndex === globalIndex

                  return (
                    <div
                      key={idx}
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
                        alt={`${sceneName} ${idx + 1}`}
                        className="w-full aspect-[3/4] object-cover"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => toggleSelect(globalIndex)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {isSelected ? '✓' : ''}
                        </button>
                        <button
                          onClick={() => setAsCover(globalIndex)}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                            isCover
                              ? 'bg-green-600 text-white'
                              : 'bg-white/20 text-white hover:bg-green-600'
                          }`}
                          title="设为封面"
                        >
                          ★
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