'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'
import { getClothingItems, ClothingItem } from '@/lib/storage'

interface SceneConfig {
  id: string
  name: string
  imagesCount: number
  season: string
  subject: string
  environment: string
  surroundings: string[]
  customPrompt: string
}

interface GeneratedImage {
  url: string
  revisedPrompt: string
  sceneId: string
  sceneName: string
}

const SCENE_STORAGE_KEY = 'visionfit_scene_configs'
const GENERATED_STORAGE_KEY = 'visionfit_generated_images'

export default function GeneratePage() {
  const [items, setItems] = useState<ClothingItem[]>([])
  const [scenes, setScenes] = useState<SceneConfig[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' })
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = getClothingItems()
    setItems(stored)

    const savedScenes = localStorage.getItem(SCENE_STORAGE_KEY)
    if (savedScenes) {
      setScenes(JSON.parse(savedScenes))
    }

    const savedImages = localStorage.getItem(GENERATED_STORAGE_KEY)
    if (savedImages) {
      setGeneratedImages(JSON.parse(savedImages))
    }
  }, [])

  const selectedItem = items.find(i => i.analysis)

  const buildPrompt = (item: ClothingItem, scene: SceneConfig): string => {
    const a = item.analysis
    if (!a) return ''

    const subjectMap: Record<string, string> = {
      '人': 'person',
      '女人': 'woman',
      '男人': 'man',
      '男孩': 'boy',
      '女孩': 'girl',
      '猫': 'cat',
      '仓鼠': 'hamster',
      '狗': 'dog',
    }

    let prompt = `Professional fashion photography of a ${subjectMap[scene.subject] || scene.subject} wearing `

    // Product details from analysis
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
      '室内': `${scene.customPrompt || 'indoor setting'}`,
      '户外': `${scene.customPrompt || 'outdoor setting'}`,
      '半室内': `${scene.customPrompt || 'semi-indoor setting'}`,
      '夜景': `${scene.customPrompt || 'night scene with city lights'}`,
    }
    prompt += `Setting: ${envMap[scene.environment] || scene.customPrompt || 'fashion photography setting'}. `

    // Surroundings
    if (scene.surroundings.length > 0) {
      prompt += `Environment elements: ${scene.surroundings.join(', ')}. `
    }

    // Quality
    prompt += `High quality, realistic, natural lighting, full body shot, fashionable retail photography style.`

    return prompt
  }

  const handleGenerate = async () => {
    if (!selectedItem || !selectedItem.analysis) {
      alert('请先完成产品分析')
      return
    }

    if (scenes.length === 0) {
      alert('请先设计场景')
      return
    }

    setGenerating(true)
    setError(null)
    setGeneratedImages([])

    // Calculate total images to generate
    const totalImages = scenes.reduce((sum, s) => sum + s.imagesCount, 0)
    let currentCount = 0
    const newImages: GeneratedImage[] = []

    try {
      for (const scene of scenes) {
        for (let i = 0; i < scene.imagesCount; i++) {
          setProgress({
            current: ++currentCount,
            total: totalImages,
            message: `生成中: ${scene.name} (${i + 1}/${scene.imagesCount})`,
          })

          const prompt = buildPrompt(selectedItem, scene)

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Generation failed')
          }

          const data = await response.json()

          for (const img of data.images) {
            newImages.push({
              url: img.url,
              revisedPrompt: img.revisedPrompt || prompt,
              sceneId: scene.id,
              sceneName: scene.name,
            })
          }
        }
      }

      setGeneratedImages(newImages)
      localStorage.setItem(GENERATED_STORAGE_KEY, JSON.stringify(newImages))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate images')
      console.error('Generation error:', err)
    } finally {
      setGenerating(false)
      setProgress({ current: 0, total: 0, message: '' })
    }
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

  return (
    <WizardLayout currentStep={4}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">生成图片</h1>
          <p className="text-gray-400 mt-1">
            共 {scenes.length} 个场景，预计生成 {scenes.reduce((s, c) => s + c.imagesCount, 0)} 张图片
          </p>
        </div>

        {/* Product & Scenes Summary */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Product */}
          <div className="col-span-3 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">产品</p>
            <img
              src={selectedItem.imageData}
              alt={selectedItem.name}
              className="w-full aspect-square object-cover rounded mb-2"
            />
            <p className="text-sm font-medium truncate">{selectedItem.name}</p>
          </div>

          {/* Scenes */}
          <div className="col-span-9 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">场景配置</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {scenes.map((scene, i) => (
                <div key={scene.id} className="bg-gray-700/50 rounded p-2">
                  <p className="text-sm font-medium truncate">{scene.name || `场景 ${i + 1}`}</p>
                  <p className="text-xs text-gray-400">
                    {scene.imagesCount}张 | {scene.environment} | {scene.subject}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mb-8">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              generating
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                {progress.message} ({progress.current}/{progress.total})
              </span>
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
                  <h3 className="text-sm font-medium text-gray-400 mb-2">{scene.name}</h3>
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