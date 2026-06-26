'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'
import { useProject } from '@/components/ProjectContext'
import {
  getClothingItemsWithAnalysis,
  getSceneConfigs,
  saveGeneratedImages,
  getGeneratedImages,
} from '@/lib/db'
import type { ClothingItemDB } from '@/components/types'
import type { SceneConfig, GeneratedImage } from '@/lib/database.types'

export default function GeneratePage() {
  const { project } = useProject()
  const [items, setItems] = useState<ClothingItemDB[]>([])
  const [scenes, setScenes] = useState<SceneConfig[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' })
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedRefImage, setSelectedRefImage] = useState<ClothingItemDB | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!project) return

      try {
        const [loadedItems, loadedScenes, loadedImages] = await Promise.all([
          getClothingItemsWithAnalysis(project.id),
          getSceneConfigs(project.id),
          getGeneratedImages(project.id),
        ])
        setItems(loadedItems)
        setScenes(loadedScenes)
        setGeneratedImages(loadedImages)

        // Auto-select first item with image_url as reference
        const refImage = loadedItems.find((i: ClothingItemDB) => i.image_url)
        if (refImage) {
          setSelectedRefImage(refImage)
        } else if (loadedItems.length > 0) {
          setSelectedRefImage(loadedItems[0])
        }
      } catch (e) {
        console.error('Failed to load data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [project])

  // Get all items with analysis for prompt building
  const analyzedItems = items.filter(i => i.analysis)
  const selectedItem = selectedRefImage || analyzedItems[0]

  const buildPrompt = (item: ClothingItemDB, scene: SceneConfig): string => {
    const a = item.analysis
    if (!a) return ''

    const subjectMap: Record<string, string> = {
      '人': 'person',
      '女人': 'woman',
      '男人': 'man',
      '男孩': 'boy',
      '女孩': 'girl',
    }

    const subject = subjectMap[scene.subject] || scene.subject

    let prompt = `Professional fashion photography of a ${subject} wearing `

    // Product details from AI analysis
    prompt += `a ${a.color} ${a.material} ${a.product_type.toLowerCase()}. `
    prompt += `Style: ${a.style}. `

    // Use AI description as base reference
    if (a.description) {
      prompt += `Product details: ${a.description} `
    }

    // Season
    prompt += `Season: ${scene.season}. `

    // Environment
    const envMap: Record<string, string> = {
      '室内': scene.customPrompt || 'indoor setting',
      '户外': scene.customPrompt || 'outdoor setting',
      '半室内': scene.customPrompt || 'semi-indoor setting',
      '夜景': scene.customPrompt || 'night scene with city lights',
    }
    const envSetting = envMap[scene.environment] || scene.customPrompt || 'fashion photography setting'
    prompt += `Setting: ${envSetting}. `

    // Surroundings
    if (scene.surroundings && scene.surroundings.length > 0) {
      prompt += `Environment elements: ${scene.surroundings.join(', ')}. `
    }

    // Quality
    prompt += `High quality, realistic, natural lighting, full body shot, fashionable retail photography style.`

    return prompt
  }

  const handleGenerate = async () => {
    if (!selectedItem?.analysis || !project) {
      alert('请先完成产品分析')
      return
    }

    if (scenes.length === 0) {
      alert('请先设计场景')
      return
    }

    // Check if we have an image_url for img2img
    if (!selectedItem.image_url) {
      alert('图片未上传到云端存储，无法使用 img2img 功能。请确保 Supabase Storage 配置正确。')
      return
    }

    setGenerating(true)
    setError(null)

    // Calculate total images to generate
    const totalImages = scenes.reduce((sum, s) => sum + (s.imagesCount || 1), 0)
    let currentCount = 0
    const newImages: GeneratedImage[] = []

    try {
      for (const scene of scenes) {
        const count = scene.imagesCount || 1
        for (let i = 0; i < count; i++) {
          setProgress({
            current: ++currentCount,
            total: totalImages,
            message: `生成中: ${scene.name || '场景'} (${i + 1}/${count})`,
          })

          const prompt = buildPrompt(selectedItem, scene)

          // Pass imageUrl for img2img
          const requestBody: { prompt: string; imageUrl: string } = {
            prompt,
            imageUrl: selectedItem.image_url!,
          }

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Generation failed')
          }

          const data = await response.json()
          const taskId = data.taskId
          if (typeof taskId !== 'string') {
            throw new Error('Generation task was not created')
          }

          let images: Array<{ url: string; revisedPrompt?: string }> | null = null
          for (let attempt = 0; attempt < 60; attempt++) {
            setProgress({
              current: currentCount,
              total: totalImages,
              message: `等待生成结果: ${scene.name || '场景'} (${i + 1}/${count})`,
            })

            await new Promise(resolve => setTimeout(resolve, 3000))

            const statusResponse = await fetch(`/api/generate/status?taskId=${encodeURIComponent(taskId)}`)
            const statusData = await statusResponse.json()

            if (!statusResponse.ok) {
              throw new Error(statusData.error || 'Generation status check failed')
            }

            if (statusData.state === 'success') {
              images = statusData.images
              break
            }
          }

          if (!images) {
            throw new Error('Generation timeout')
          }

          for (const img of images) {
            newImages.push({
              url: img.url,
              revisedPrompt: img.revisedPrompt || prompt,
              sceneId: scene.id || '',
              sceneName: scene.name || '未命名场景',
            })
          }
        }
      }

      // Save to Supabase DB
      if (newImages.length > 0) {
        await saveGeneratedImages(project.id, newImages)
      }

      // Reload from DB to get IDs
      const savedImages = await getGeneratedImages(project.id)
      setGeneratedImages(savedImages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate images')
      console.error('Generation error:', err)
    } finally {
      setGenerating(false)
      setProgress({ current: 0, total: 0, message: '' })
    }
  }

  if (!project || loading) {
    return (
      <WizardLayout currentStep={4}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400">加载中...</p>
        </div>
      </WizardLayout>
    )
  }

  if (items.length === 0) {
    return (
      <WizardLayout currentStep={4}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400 mb-4">请先上传图片</p>
          <Link href="/upload" className="text-blue-400 hover:text-blue-300">← 返回上传</Link>
        </div>
      </WizardLayout>
    )
  }

  if (!selectedItem?.analysis) {
    return (
      <WizardLayout currentStep={4}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400 mb-4">请先完成产品分析</p>
          <Link href="/analysis" className="text-blue-400 hover:text-blue-300">← 返回分析</Link>
        </div>
      </WizardLayout>
    )
  }

  const totalToGenerate = scenes.reduce((s, c) => s + (c.imagesCount || 1), 0)

  return (
    <WizardLayout currentStep={4}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">生成图片</h1>
          <p className="text-gray-400 mt-1">
            共 {scenes.length} 个场景，预计生成 {totalToGenerate} 张图片
          </p>
        </div>

        {/* Product & Scenes Summary */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Reference Image Selection */}
          <div className="col-span-3 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">参考图（用于 img2img）</p>
            {selectedItem?.image_url ? (
              <>
                <img
                  src={selectedItem.image_data}
                  alt={selectedItem.name}
                  className="w-full aspect-square object-cover rounded mb-2 border-2 border-purple-500"
                />
                <p className="text-xs text-purple-400 mb-2">✓ 使用原图生成</p>
                {items.filter(i => i.image_url).length > 1 && (
                  <select
                    value={selectedItem.id}
                    onChange={(e) => {
                      const item = items.find(i => i.id === e.target.value)
                      if (item) setSelectedRefImage(item)
                    }}
                    className="w-full bg-gray-700 text-white text-xs rounded p-1"
                  >
                    {items.filter(i => i.image_url).map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <div className="text-xs text-yellow-400">
                <p>⚠️ 未找到可用的参考图</p>
                <p className="text-gray-500 mt-1">图片需上传到 Storage</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2 truncate">{selectedItem?.name}</p>
          </div>

          {/* Scenes */}
          <div className="col-span-9 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">场景配置</p>
            {scenes.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {scenes.map((scene, i) => (
                  <div key={scene.id} className="bg-gray-700/50 rounded p-2">
                    <p className="text-sm font-medium truncate">{scene.name || `场景 ${i + 1}`}</p>
                    <p className="text-xs text-gray-400">
                      {scene.imagesCount || 1}张 | {scene.environment} | {scene.subject}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">暂无场景配置</p>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="mb-8">
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedItem?.image_url}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              generating
                ? 'bg-gray-700 text-gray-400'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                {progress.message} ({progress.current}/{progress.total})
              </span>
            ) : !selectedItem?.image_url ? (
              '⚠️ 参考图未上传到云端'
            ) : (
              '✨ 开始生成图片'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 bg-red-500/20 border border-red-500 rounded-xl p-4 text-red-400">
            <p className="font-medium">错误</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Generated Results */}
        {generatedImages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">生成结果（{generatedImages.length}张）</h2>
              <Link
                href="/review"
                className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                继续：审核发布 →
              </Link>
            </div>

            {/* Group by scene */}
            {scenes.map(scene => {
              const sceneImages = generatedImages.filter(img => img.sceneId === scene.id)
              if (sceneImages.length === 0) return null

              return (
                <div key={scene.id} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">{scene.name || '未命名场景'}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sceneImages.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img.url}
                          alt={`${scene.name} ${idx + 1}`}
                          className="w-full aspect-[3/4] object-cover rounded-lg border border-gray-700"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <a
                            href={img.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 px-3 py-1.5 rounded-lg text-sm"
                          >
                            查看大图
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Link href="/scene" className="text-gray-400 hover:text-white transition-colors">
            ← 场景设计
          </Link>
        </div>
      </div>
    </WizardLayout>
  )
}
