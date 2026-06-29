'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import WizardLayout from '@/components/WizardLayout'
import { useProject } from '@/components/ProjectContext'
import {
  getClothingItemsWithAnalysis,
  getSceneConfigs,
  saveSceneConfigs,
} from '@/lib/db'
import type { ClothingItemDB } from '@/components/types'
import type { SceneConfig } from '@/lib/database.types'

interface SceneConfigUI {
  id: string
  name: string
  imagesCount: number
  season: string
  subject: string
  environment: string
  surroundings: string[]
  customPrompt: string
}

const PRESET_SCENES = [
  {
    id: 'coffee_shop',
    name: '咖啡厅 / Café',
    defaultSeason: 'Autumn',
    defaultSubject: '人',
    defaultEnvironment: '室内',
    defaultSurroundings: ['木桌', '咖啡杯', '暖色灯光'],
    prompt: 'modern coffee shop interior, warm lighting, wooden tables, cozy atmosphere',
  },
  {
    id: 'urban_street',
    name: '城市街道 / Urban Street',
    defaultSeason: 'Spring',
    defaultSubject: '人',
    defaultEnvironment: '户外',
    defaultSurroundings: ['高楼', '行人', '街道'],
    prompt: 'busy urban street, city buildings, pedestrians, natural daylight',
  },
  {
    id: 'park',
    name: '公园 / Park',
    defaultSeason: 'Spring',
    defaultSubject: '人',
    defaultEnvironment: '户外',
    defaultSurroundings: ['草坪', '树木', '天空'],
    prompt: 'public park, green lawn, trees, blue sky, natural sunlight',
  },
  {
    id: 'office',
    name: '办公室 / Office',
    defaultSeason: 'All',
    defaultSubject: '人',
    defaultEnvironment: '室内',
    defaultSurroundings: ['办公桌', '电脑', '落地窗'],
    prompt: 'modern office interior, desk, computer, floor-to-ceiling windows, professional lighting',
  },
  {
    id: 'beach',
    name: '海滩 / Beach',
    defaultSeason: 'Summer',
    defaultSubject: '人',
    defaultEnvironment: '户外',
    defaultSurroundings: ['大海', '沙滩', '天空'],
    prompt: 'beachside, ocean waves, sandy beach, blue sky, sunny day',
  },
  {
    id: 'sports_field',
    name: '运动场 / Sports Field',
    defaultSeason: 'Summer',
    defaultSubject: '人',
    defaultEnvironment: '户外',
    defaultSurroundings: ['草坪', '看台', '天空'],
    prompt: 'sports field, green grass, stadium backdrop, athletic setting',
  },
  {
    id: 'home_lifestyle',
    name: '家居生活 / Home Lifestyle',
    defaultSeason: 'All',
    defaultSubject: '人',
    defaultEnvironment: '室内',
    defaultSurroundings: ['沙发', '抱枕', '自然光'],
    prompt: 'cozy living room, sofa, cushions, natural window light, home atmosphere',
  },
  {
    id: 'studio',
    name: '摄影棚 / Studio',
    defaultSeason: 'All',
    defaultSubject: '人',
    defaultEnvironment: '室内',
    defaultSurroundings: ['纯色背景', '专业灯光'],
    prompt: 'professional photography studio, clean solid background, studio lighting, fashion shoot',
  },
]

const SEASONS = ['Spring', 'Summer', 'Fall', 'Autumn', 'Winter', 'All-season']
const SUBJECTS = ['人', '女人', '男人', '男孩', '女孩']
const ENVIRONMENTS = ['室内', '户外', '半室内', '夜景']
const SURROUNDINGS_OPTIONS = [
  '天空', '大海', '沙滩', '草坪', '树木', '花卉',
  '高楼', '街道', '咖啡杯', '木桌', '沙发', '抱枕',
  '电脑', '办公桌', '书架', '灯具', '绿植', '墙面',
]

function createEmptyScene(): SceneConfigUI {
  return {
    id: `scene_${Date.now()}`,
    name: '',
    imagesCount: 1,
    season: 'Spring',
    subject: '人',
    environment: '户外',
    surroundings: [],
    customPrompt: '',
  }
}

export default function ScenePage() {
  const { project } = useProject()
  const router = useRouter()
  const [items, setItems] = useState<ClothingItemDB[]>([])
  const [scenes, setScenes] = useState<SceneConfigUI[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      if (!project) return
      try {
        const [loadedItems, loadedScenes] = await Promise.all([
          getClothingItemsWithAnalysis(project.id),
          getSceneConfigs(project.id),
        ])
        setItems(loadedItems)
        if (loadedScenes.length > 0) {
          setScenes(loadedScenes.map(s => ({
            id: s.id || `scene_${Date.now()}`,
            name: s.name,
            imagesCount: s.imagesCount,
            season: s.season,
            subject: s.subject,
            environment: s.environment,
            surroundings: s.surroundings || [],
            customPrompt: s.customPrompt || '',
          })))
        } else {
          setScenes([createEmptyScene()])
        }
      } catch (e) {
        console.error('Failed to load data:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [project])

  const addScene = () => {
    if (scenes.length >= 10) {
      alert('最多添加10个场景')
      return
    }
    setScenes([...scenes, createEmptyScene()])
  }

  const removeScene = (id: string) => {
    if (scenes.length <= 1) {
      alert('至少保留一个场景')
      return
    }
    setScenes(scenes.filter(s => s.id !== id))
  }

  const updateScene = (id: string, updates: Partial<SceneConfigUI>) => {
    setScenes(scenes.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const applyPreset = (sceneId: string, preset: typeof PRESET_SCENES[0]) => {
    updateScene(sceneId, {
      name: preset.name,
      season: preset.defaultSeason,
      subject: preset.defaultSubject,
      environment: preset.defaultEnvironment,
      surroundings: [...preset.defaultSurroundings],
      customPrompt: preset.prompt,
    })
  }

  const handleSave = async () => {
    if (!project) return false
    setSaving(true)
    try {
      // Convert UI scenes to DB format
      const dbScenes: SceneConfig[] = scenes.map((s) => ({
        id: s.id.startsWith('scene_') ? '' : s.id, // Empty id means insert
        name: s.name,
        imagesCount: s.imagesCount,
        season: s.season,
        subject: s.subject,
        environment: s.environment,
        surroundings: s.surroundings,
        customPrompt: s.customPrompt,
        preset_id: undefined,
      }))
      await saveSceneConfigs(project.id, dbScenes)
      const savedScenes = await getSceneConfigs(project.id)
      setScenes(savedScenes.map(s => ({
        id: s.id || `scene_${Date.now()}`,
        name: s.name,
        imagesCount: s.imagesCount,
        season: s.season,
        subject: s.subject,
        environment: s.environment,
        surroundings: s.surroundings || [],
        customPrompt: s.customPrompt || '',
      })))
      alert('场景配置已保存！')
      return true
    } catch (e) {
      console.error('Failed to save scenes:', e)
      alert('保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = async () => {
    const saved = await handleSave()
    if (saved) router.push('/generate')
  }

  const selectedItem = items.find(i => i.analysis)

  if (!project || loading) {
    return (
      <WizardLayout currentStep={3}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400">加载中...</p>
        </div>
      </WizardLayout>
    )
  }

  if (items.length === 0) {
    return (
      <WizardLayout currentStep={3}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400 mb-4">请先上传图片</p>
          <Link href="/upload" className="text-blue-400 hover:text-blue-300">
            ← 返回上传
          </Link>
        </div>
      </WizardLayout>
    )
  }

  return (
    <WizardLayout currentStep={3}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">场景设计</h1>
          <p className="text-gray-400 mt-1">设计生成图片的场景和参数</p>
        </div>

        {/* Product Summary */}
        {selectedItem && selectedItem.analysis && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
            <p className="text-sm text-gray-400 mb-2">当前产品</p>
            <div className="flex items-center gap-4">
              <img
                src={selectedItem.image_data}
                alt={selectedItem.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div>
                <p className="font-medium">{selectedItem.name}</p>
                <p className="text-sm text-gray-400">
                  {selectedItem.analysis.product_type} | {selectedItem.analysis.color_main} | {selectedItem.analysis.silhouette}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scenes */}
        <div className="space-y-6">
          {scenes.map((scene, index) => (
            <div key={scene.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">场景 {index + 1}</h3>
                <div className="flex items-center gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const preset = PRESET_SCENES.find(p => p.id === e.target.value)
                      if (preset) applyPreset(scene.id, preset)
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
                  >
                    <option value="">应用预设场景...</option>
                    {PRESET_SCENES.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {scenes.length > 1 && (
                    <button
                      onClick={() => removeScene(scene.id)}
                      className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 text-sm"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Scene Name */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">场景名称</label>
                  <input
                    type="text"
                    value={scene.name}
                    onChange={e => updateScene(scene.id, { name: e.target.value })}
                    placeholder="如：咖啡厅拍照"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>

                {/* Images Count */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">生成数量</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={scene.imagesCount}
                    onChange={e => updateScene(scene.id, { imagesCount: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>

                {/* Season */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">季节</label>
                  <select
                    value={scene.season}
                    onChange={e => updateScene(scene.id, { season: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    {SEASONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">主体</label>
                  <select
                    value={scene.subject}
                    onChange={e => updateScene(scene.id, { subject: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    {SUBJECTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Environment */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">环境</label>
                <div className="flex flex-wrap gap-2">
                  {ENVIRONMENTS.map(env => (
                    <button
                      key={env}
                      onClick={() => updateScene(scene.id, { environment: env })}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        scene.environment === env
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>

              {/* Surroundings */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 block mb-1">周围元素（可多选）</label>
                <div className="flex flex-wrap gap-2">
                  {SURROUNDINGS_OPTIONS.map(surr => (
                    <button
                      key={surr}
                      onClick={() => {
                        const newSurroundings = scene.surroundings.includes(surr)
                          ? scene.surroundings.filter(s => s !== surr)
                          : [...scene.surroundings, surr]
                        updateScene(scene.id, { surroundings: newSurroundings })
                      }}
                      className={`px-3 py-1.5 rounded text-sm transition-colors ${
                        scene.surroundings.includes(surr)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {surr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">自定义场景描述（可选）</label>
                <textarea
                  value={scene.customPrompt}
                  onChange={e => updateScene(scene.id, { customPrompt: e.target.value })}
                  placeholder="输入英文场景描述，将与AI分析结合生成最终提示词..."
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm min-h-[60px] resize-y"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add Scene Button */}
        <button
          onClick={addScene}
          disabled={scenes.length >= 10}
          className="mt-4 w-full py-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + 添加场景（{scenes.length}/10）
        </button>

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <Link href="/analysis" className="text-gray-400 hover:text-white transition-colors">
            ← 产品分析
          </Link>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '💾 保存配置'}
            </button>
            <button
              onClick={handleContinue}
              disabled={saving}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              保存并继续：生成图片 →
            </button>
          </div>
        </div>
      </div>
    </WizardLayout>
  )
}
