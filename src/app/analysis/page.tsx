'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import WizardLayout from '@/components/WizardLayout'
import { useProject } from '@/components/ProjectContext'
import {
  getClothingItemsWithAnalysis,
  saveProductAnalysis,
  getProductAnalysis,
} from '@/lib/db'
import type { ClothingItemDB } from '@/components/types'

interface ProductAnalysis {
  product_type: string
  color_main: string
  color_accents: string
  material_texture: string
  logo_position: string
  logo_style: string
  special_features: string[]
  silhouette: string
  description: string
}

const defaultAnalysis: ProductAnalysis = {
  product_type: '',
  color_main: '',
  color_accents: '',
  material_texture: '',
  logo_position: '',
  logo_style: '',
  special_features: [],
  silhouette: '',
  description: '',
}

export default function AnalysisPage() {
  const { project } = useProject()
  const [items, setItems] = useState<ClothingItemDB[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analysis, setAnalysis] = useState<ProductAnalysis>(defaultAnalysis)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadItems = async () => {
      if (!project) return
      try {
        const loadedItems = await getClothingItemsWithAnalysis(project.id)
        setItems(loadedItems)
        if (loadedItems.length > 0 && !selectedId) {
          setSelectedId(loadedItems[0].id)
        }
      } catch (e) {
        console.error('Failed to load items:', e)
      } finally {
        setLoading(false)
      }
    }
    loadItems()
  }, [project, selectedId])

  useEffect(() => {
    const loadAnalysis = async () => {
      if (!selectedId || !project) return

      // Load project-level analysis from Supabase
      try {
        const projectAnalysis = await getProductAnalysis(project.id)
        if (projectAnalysis) {
          setAnalysis({
            product_type: projectAnalysis.product_type || '',
            color_main: (projectAnalysis as any).color_main || '',
            color_accents: (projectAnalysis as any).color_accents || '',
            material_texture: (projectAnalysis as any).material_texture || '',
            logo_position: (projectAnalysis as any).logo_position || '',
            logo_style: (projectAnalysis as any).logo_style || '',
            special_features: (projectAnalysis as any).special_features || [],
            silhouette: (projectAnalysis as any).silhouette || '',
            description: projectAnalysis.description || '',
          })
          setSaved(true)
        } else {
          setAnalysis(defaultAnalysis)
          setSaved(false)
        }
      } catch (e) {
        console.error('Failed to load analysis:', e)
        setAnalysis(defaultAnalysis)
        setSaved(false)
      }
      setEditing(false)
    }
    loadAnalysis()
  }, [selectedId, project])

  const selectedItem = items.find(i => i.id === selectedId)

  const handleAnalyze = async () => {
    if (!selectedItem || !project) return

    setAnalyzing(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: selectedItem.image_data }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      setAnalysis(data.analysis.analysis || data.analysis)
      setSaved(false)
    } catch (err) {
      console.error('Analyze error:', err)
      alert(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  // 综合分析 - 分析所有图片并汇总
  const handleBatchAnalyze = async () => {
    if (items.length === 0 || !project) return

    setBatchAnalyzing(true)

    try {
      const imageDataList = items.map(item => item.image_data)

      const response = await fetch('/api/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataList }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      setAnalysis(data.analysis.analysis || data.analysis)
      setSaved(false)
      alert('综合分析完成！请检查结果并保存。')
    } catch (err) {
      console.error('Batch analyze error:', err)
      alert(err instanceof Error ? err.message : '综合分析失败')
    } finally {
      setBatchAnalyzing(false)
    }
  }

  const handleSave = async () => {
    console.log('handleSave called', { selectedId, projectId: project?.id, analysis })
    if (!selectedId || !project) {
      alert('保存失败：没有选中图片或项目未加载')
      return
    }

    setSaving(true)
    try {
      await saveProductAnalysis(project.id, analysis)
      setSaved(true)
      setEditing(false)
      // Reload items to update analysis status
      const loadedItems = await getClothingItemsWithAnalysis(project.id)
      setItems(loadedItems)
    } catch (e) {
      console.error('Failed to save analysis:', e)
      alert('保存失败: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (field: keyof ProductAnalysis, value: string | string[]) => {
    setAnalysis(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  if (!project || loading) {
    return (
      <WizardLayout currentStep={2}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400">加载中...</p>
        </div>
      </WizardLayout>
    )
  }

  if (items.length === 0) {
    return (
      <WizardLayout currentStep={2}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <p className="text-gray-400 mb-4">还没有上传任何图片</p>
          <Link href="/upload" className="text-blue-400 hover:text-blue-300">
            ← 返回上传
          </Link>
        </div>
      </WizardLayout>
    )
  }

  return (
    <WizardLayout currentStep={2}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">产品分析</h1>
          <p className="text-gray-400 mt-1">
            已上传 {items.length} 张图片 - 点击&quot;综合分析&quot;汇总所有图片
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left: Image Selection */}
          <div className="col-span-3">
            <h3 className="text-sm font-medium text-gray-400 mb-3">已上传图片（{items.length}张）</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                    selectedId === item.id
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <img
                    src={item.image_data}
                    alt={item.name}
                    className="w-full aspect-square object-cover rounded mb-2"
                  />
                  <p className="text-xs truncate">{item.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Analysis Form */}
          <div className="col-span-9">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              {/* Batch Analyze Button - Prominent */}
              <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-4 mb-6 border border-purple-500/30">
                <h3 className="text-lg font-semibold text-white mb-2">🤖 综合分析</h3>
                <p className="text-sm text-gray-300 mb-3">
                  将所有 {items.length} 张图片发送给 AI，综合分析出一个完整的产品描述
                </p>
                <button
                  onClick={handleBatchAnalyze}
                  disabled={batchAnalyzing}
                  className={`w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    batchAnalyzing
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                  }`}
                >
                  {batchAnalyzing ? '⏳ 综合分析中...' : '✨ 综合分析所有图片'}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-gray-700"></div>
                <span className="text-sm text-gray-500">或单独分析</span>
                <div className="flex-1 h-px bg-gray-700"></div>
              </div>

              {/* Single Image Analyze */}
              {selectedItem && (
                <>
                  <div className="flex gap-6 mb-6 pb-6 border-b border-gray-700">
                    <img
                      src={selectedItem.image_data}
                      alt={selectedItem.name}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">{selectedItem.name}</h3>
                      <p className="text-sm text-gray-400 mb-3">选择上方某张图片，单独分析</p>
                      <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className={`px-5 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          analyzing
                            ? 'bg-gray-700 text-gray-400'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {analyzing ? '⏳ 分析中...' : '🔍 单独分析这张'}
                      </button>
                    </div>
                  </div>

                    {/* Analysis Fields */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <Field
                        label="产品类型"
                        value={analysis.product_type}
                        onChange={v => handleFieldChange('product_type', v)}
                        editing={editing}
                        placeholder="如：滑雪服、羽绒服、跑鞋"
                      />
                      <Field
                        label="主色"
                        value={analysis.color_main}
                        onChange={v => handleFieldChange('color_main', v)}
                        editing={editing}
                        placeholder="如：深黑色、纯白、藏青色"
                      />
                      <Field
                        label="配色/细节色"
                        value={analysis.color_accents}
                        onChange={v => handleFieldChange('color_accents', v)}
                        editing={editing}
                        placeholder="如：袖口白色撞色条纹、左胸口红色Logo"
                      />
                      <Field
                        label="材质+纹理"
                        value={analysis.material_texture}
                        onChange={v => handleFieldChange('material_texture', v)}
                        editing={editing}
                        placeholder="如：哑光尼龙面料，横格纹衍缝"
                      />
                      <Field
                        label="Logo位置"
                        value={analysis.logo_position}
                        onChange={v => handleFieldChange('logo_position', v)}
                        editing={editing}
                        placeholder="如：左胸口、右侧袖口、后背上部"
                      />
                      <Field
                        label="Logo样式"
                        value={analysis.logo_style}
                        onChange={v => handleFieldChange('logo_style', v)}
                        editing={editing}
                        placeholder="如：3cm白色刺绣、黑色反光印刷字样"
                      />
                      <Field
                        label="轮廓/版型"
                        value={analysis.silhouette}
                        onChange={v => handleFieldChange('silhouette', v)}
                        editing={editing}
                        placeholder="如：宽松中长款、过臀长度、修身锥形裤"
                      />
                    </div>

                    {/* Special Features */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">特殊细节</h4>
                      <Field
                        label=""
                        value={analysis.special_features.join('；')}
                        onChange={v => handleFieldChange('special_features' as any, v.split('；').filter(Boolean))}
                        editing={editing}
                        placeholder="防水压胶接缝、可拆卸毛领、内层加绒（用分号分隔多个细节）"
                        multiline
                      />
                      <p className="text-xs text-gray-500 mt-1">多个细节用分号分隔</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-2">产品描述（营销文案）</h4>
                      <Field
                        label=""
                        value={analysis.description}
                        onChange={v => handleFieldChange('description', v)}
                        editing={editing}
                        placeholder="简洁的营销文案，1-2句话描述产品卖点..."
                        multiline
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-700">
                      {(editing || !saved) && (
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {saving ? '保存中...' : '💾 保存分析结果'}
                        </button>
                      )}
                      {saved && !editing && (
                        <button
                          onClick={() => setEditing(true)}
                          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                        >
                          ✏️ 编辑
                        </button>
                      )}
                      {editing && (
                        <button
                          onClick={() => {
                            setEditing(false)
                            // Reload analysis
                            getProductAnalysis(project!.id).then(data => {
                              if (data) {
                                setAnalysis({
                                  product_type: data.product_type || '',
                                  color_main: data.color_main || '',
                                  color_accents: data.color_accents || '',
                                  material_texture: data.material_texture || '',
                                  logo_position: data.logo_position || '',
                                  logo_style: data.logo_style || '',
                                  special_features: data.special_features || [],
                                  silhouette: data.silhouette || '',
                                  description: data.description || '',
                                })
                              }
                            })
                          }}
                          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                        >
                          取消
                        </button>
                      )}
                      {saved && !editing && (
                        <span className="flex items-center text-green-400 text-sm">
                          ✓ 已保存
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex justify-between">
              <Link href="/upload" className="text-gray-400 hover:text-white transition-colors">
                ← 上传图片
              </Link>
              <Link
                href="/scene"
                className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                继续：场景设计 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </WizardLayout>
  )
}

function Field({
  label,
  value,
  onChange,
  editing,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  editing: boolean
  placeholder: string
  multiline?: boolean
}) {
  if (!editing) {
    return (
      <div>
        {label && <span className="text-xs text-gray-400 block mb-1">{label}</span>}
        <div className="bg-gray-700/50 rounded-lg px-3 py-2 text-white min-h-[38px]">
          {value || <span className="text-gray-500">-</span>}
        </div>
      </div>
    )
  }

  if (multiline) {
    return (
      <div>
        {label && <span className="text-xs text-gray-400 block mb-1">{label}</span>}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white min-h-[120px] resize-y"
        />
      </div>
    )
  }

  return (
    <div>
      {label && <span className="text-xs text-gray-400 block mb-1">{label}</span>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
      />
    </div>
  )
}
