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

interface PlatformConfig {
  id: string
  platform: string
  content_format: string
  aspect_ratio: string
  width: number
  height: number
  description: string | null
}

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
  const [imgStrength, setImgStrength] = useState(0.8) // img2img strength: 0-1, higher = more faithful to original

  // Platform config state
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('3:4')

  // Brand watermark toggle
  const [embedBrand, setEmbedBrand] = useState(false)

  // Load platform configs on mount
  useEffect(() => {
    const loadPlatformConfigs = async () => {
      try {
        const res = await fetch('/api/platform/configs')
        const data = await res.json()
        if (data.configs && data.configs.length > 0) {
          setPlatformConfigs(data.configs)
          // Default to Facebook + post (1:1)
          const defaultConfig = data.configs.find((c: PlatformConfig) => c.platform === 'facebook' && c.content_format === 'post')
          if (defaultConfig) {
            setSelectedPlatform('facebook')
            setSelectedFormat('post')
            setSelectedAspectRatio(defaultConfig.aspect_ratio)
          }
        }
      } catch (e) {
        console.error('Failed to load platform configs:', e)
      }
    }
    loadPlatformConfigs()
  }, [])

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

  // Get unique platforms from configs
  const platforms = Array.from(new Set(platformConfigs.map(c => c.platform)))

  // Get available formats for selected platform
  const availableFormats = platformConfigs
    .filter(c => c.platform === selectedPlatform)
    .map(c => ({ format: c.content_format, aspect_ratio: c.aspect_ratio, description: c.description }))

  // Handle platform/formatted change
  const handleFormatChange = (platform: string, format: string) => {
    setSelectedPlatform(platform)
    setSelectedFormat(format)
    const config = platformConfigs.find(c => c.platform === platform && c.content_format === format)
    if (config) {
      setSelectedAspectRatio(config.aspect_ratio)
    }
  }

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

    // Product type
    prompt += `${a.product_type}. `

    // Color - with EXACT hex as CRITICAL constraint
    prompt += `Color: ${a.color_main}. `
    if (a.color_main_hex) {
      prompt += `CRITICAL: The primary color MUST be exactly ${a.color_main_hex.toUpperCase()} - do not deviate. `
    }
    if (a.color_accents) {
      prompt += `Color accents: ${a.color_accents}. `
    }
    if (a.color_accents_hex) {
      prompt += `CRITICAL: The accent color MUST be exactly ${a.color_accents_hex.toUpperCase()} - do not deviate. `
    }

    // Material and texture
    if (a.material_texture) {
      prompt += `Material and texture: ${a.material_texture}. `
    }

    // Logo details - position and style
    if (a.logo_position || a.logo_style) {
      prompt += `Logo details: `
      if (a.logo_position) prompt += `positioned ${a.logo_position}, `
      if (a.logo_style) prompt += `${a.logo_style}. `
    }

    // Special features
    if (a.special_features && a.special_features.length > 0) {
      prompt += `Key features: ${a.special_features.join(', ')}. `
    }

    // Silhouette
    if (a.silhouette) {
      prompt += `Fit and silhouette: ${a.silhouette}. `
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

    // Use processed_image_url (transparent background) for img2img if available, fallback to original
    const refImage = selectedItem.processed_image_url || selectedItem.image_url
    if (!refImage) {
      alert('图片未上传到云端存储，无法使用 img2img 功能。请确保 Supabase Storage 配置正确。')
      return
    }

    setGenerating(true)
    setError(null)

    const totalImages = scenes.reduce((sum, s) => sum + (s.imagesCount || 1), 0)
    let currentCount = 0
    const newImages: GeneratedImage[] = []

    try {
      for (const scene of scenes) {
        const count = scene.imagesCount || 1
        for (let i = 0; i < count; i++) {
          currentCount++
          setProgress({
            current: currentCount,
            total: totalImages,
            message: `生成中: ${scene.name || '场景'} (${i + 1}/${count})`,
          })

          const prompt = buildPrompt(selectedItem, scene)
          const requestBody: { prompt: string; imageUrl: string; strength: number; aspectRatio: string } = {
            prompt,
            imageUrl: refImage,
            strength: imgStrength,
            aspectRatio: selectedAspectRatio,
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

      if (newImages.length > 0) {
        await saveGeneratedImages(project.id, newImages)

        // Apply brand watermark if enabled
        if (embedBrand) {
          const savedWithIds = await getGeneratedImages(project.id)
          const newSavedImages = savedWithIds.filter(
            (img: GeneratedImage) => !generatedImages.some(g => g.id === img.id)
          )

          setProgress({
            current: 0,
            total: newSavedImages.length,
            message: '正在嵌入品牌信息...',
          })

          for (let i = 0; i < newSavedImages.length; i++) {
            setProgress({
              current: i + 1,
              total: newSavedImages.length,
              message: `嵌入品牌信息 (${i + 1}/${newSavedImages.length})`,
            })

            try {
              const wmRes = await fetch('/api/watermark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: newSavedImages[i].url }),
              })

              if (wmRes.ok) {
                const wmData = await wmRes.json()
                // Update the image URL with watermarked version
                newSavedImages[i] = { ...newSavedImages[i], url: wmData.url }
              }
            } catch (e) {
              console.error('Watermark failed for image:', newSavedImages[i].id, e)
            }
          }

          // Re-save with updated URLs
          await saveGeneratedImages(project.id, newSavedImages)
        }
      }

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

        {/* Platform Selection */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <label className="text-xs text-gray-400 block mb-2">平台</label>
              <div className="flex gap-2">
                {platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      const configs = platformConfigs.filter(c => c.platform === p)
                      if (configs.length > 0) {
                        handleFormatChange(p, configs[0].content_format)
                      }
                    }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPlatform === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {p === 'facebook' ? 'Facebook' :
                     p === 'instagram' ? 'Instagram' :
                     p === 'tiktok' ? 'TikTok' :
                     p === 'youtube' ? 'YouTube' : p}
                  </button>
                ))}
              </div>
            </div>

            {selectedPlatform && (
              <div>
                <label className="text-xs text-gray-400 block mb-2">内容格式</label>
                <div className="flex gap-2 flex-wrap">
                  {availableFormats.map(f => (
                    <button
                      key={f.format}
                      onClick={() => handleFormatChange(selectedPlatform, f.format)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedFormat === f.format
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title={f.description || ''}
                    >
                      {f.format === 'reel' ? 'Reel' :
                       f.format === 'story' ? 'Story' :
                       f.format === 'post' ? 'Post' :
                       f.format === 'carousel' ? 'Carousel' : f.format}
                      <span className="ml-1 text-xs opacity-70">{f.aspect_ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedAspectRatio && (
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">输出尺寸</p>
                <p className="text-white font-medium">
                  {platformConfigs.find(c => c.platform === selectedPlatform && c.content_format === selectedFormat)?.width || '?'} × {platformConfigs.find(c => c.platform === selectedPlatform && c.content_format === selectedFormat)?.height || '?'}
                </p>
              </div>
            )}

            {/* Brand embed toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-400 cursor-pointer select-none" htmlFor="embed-brand-toggle">
                嵌入品牌信息
              </label>
              <button
                id="embed-brand-toggle"
                onClick={() => setEmbedBrand(!embedBrand)}
                className={`relative w-10 h-5 rounded-full transition-colors ${embedBrand ? 'bg-purple-600' : 'bg-gray-600'}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${embedBrand ? 'left-5 translate-x-0' : 'left-0.5'}`}
                />
              </button>
            </div>
          </div>
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
                {/* Strength slider */}
                <div className="mt-2">
                  <label className="text-xs text-gray-400 block mb-1">
                    原图保留强度: {Math.round(imgStrength * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={imgStrength}
                    onChange={(e) => setImgStrength(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {imgStrength >= 0.8 ? '高保真，接近原图' : imgStrength >= 0.5 ? '中等，可适当变化' : '高创意，自由度高'}
                  </p>
                </div>
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
