'use client'

/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef } from 'react'
import WizardLayout from '@/components/WizardLayout'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface BrandProfile {
  id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  contact_whatsapp: string | null
  website_url: string | null
  logo_url: string | null
  watermark_style: string
  watermark_position: string
  qr_code_url: string | null
}

interface BrandAsset {
  id: string
  asset_type: string
  file_name: string | null
  file_url: string
  file_size: number | null
  mime_type: string | null
  description: string | null
  usage_count: number
  created_at: string
}

const ASSET_TYPES = [
  { value: 'certification', label: '认证文件（CE/FCC/其他）' },
  { value: 'factory', label: '工厂照片' },
  { value: 'shipping', label: '发货照片' },
  { value: 'logo', label: '品牌Logo' },
  { value: 'other', label: '其他' },
]

const WATERMARK_STYLES = [
  { value: 'corner', label: '角落水印' },
  { value: 'center', label: '居中水印' },
  { value: 'disabled', label: '不添加水印' },
]

const WATERMARK_POSITIONS = [
  { value: 'bottom-right', label: '右下角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'top-right', label: '右上角' },
  { value: 'top-left', label: '左上角' },
]

export default function BrandPage() {
  const [profile, setProfile] = useState<BrandProfile | null>(null)
  const [assets, setAssets] = useState<BrandAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactWhatsapp, setContactWhatsapp] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [watermarkStyle, setWatermarkStyle] = useState('corner')
  const [watermarkPosition, setWatermarkPosition] = useState('bottom-right')

  // Upload fields
  const [uploadType, setUploadType] = useState('certification')
  const [uploadDesc, setUploadDesc] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Load profile
      const profileRes = await fetch('/api/brand/profile')
      const profileData = await profileRes.json()
      if (profileData.profile) {
        setProfile(profileData.profile)
        setName(profileData.profile.name || '')
        setContactEmail(profileData.profile.contact_email || '')
        setContactPhone(profileData.profile.contact_phone || '')
        setContactWhatsapp(profileData.profile.contact_whatsapp || '')
        setWebsiteUrl(profileData.profile.website_url || '')
        setLogoUrl(profileData.profile.logo_url || '')
        setQrCodeUrl(profileData.profile.qr_code_url || '')
        setWatermarkStyle(profileData.profile.watermark_style || 'corner')
        setWatermarkPosition(profileData.profile.watermark_position || 'bottom-right')
      }

      // Load assets
      const assetsRes = await fetch('/api/brand/assets')
      const assetsData = await assetsRes.json()
      if (assetsData.assets) {
        setAssets(assetsData.assets)
      }
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fallback: force stop loading after 10s
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10000)
    return () => clearTimeout(timer)
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setMessage({ type: 'error', text: '品牌名称不能为空' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/brand/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          contact_whatsapp: contactWhatsapp || null,
          website_url: websiteUrl || null,
          logo_url: logoUrl || null,
          watermark_style: watermarkStyle,
          watermark_position: watermarkPosition,
          qr_code_url: qrCodeUrl || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '保存失败' })
      } else {
        setProfile(data.profile)
        setMessage({ type: 'success', text: '品牌信息已保存' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) {
      setMessage({ type: 'error', text: '请选择文件' })
      return
    }

    setUploading(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('asset_type', uploadType)
      formData.append('description', uploadDesc)

      const res = await fetch('/api/brand/assets', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || '上传失败' })
      } else {
        setAssets([data.asset, ...assets])
        setSelectedFile(null)
        setUploadDesc('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        setMessage({ type: 'success', text: '文件上传成功' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: '上传失败' })
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteAsset(assetId: string) {
    if (!confirm('确定要删除这个资产吗？')) return

    try {
      const res = await fetch(`/api/brand/assets?id=${assetId}`, { method: 'DELETE' })
      if (res.ok) {
        setAssets(assets.filter(a => a.id !== assetId))
        setMessage({ type: 'success', text: '已删除' })
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '删除失败' })
      }
    } catch {
      setMessage({ type: 'error', text: '删除失败' })
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) {
    return (
      <WizardLayout currentStep={0} title="品牌设置" description="管理品牌信息和资质材料">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">加载中...</div>
        </div>
      </WizardLayout>
    )
  }

  return (
    <WizardLayout currentStep={0} title="品牌设置" description="管理品牌信息和资质材料，为生成图片添加信任背书">
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Brand Info Form */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">品牌/公司名称 *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your Brand Name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="contact@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+86 xxx xxxx xxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
              <input
                type="tel"
                value={contactWhatsapp}
                onChange={e => setContactWhatsapp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+92 xxx xxxx xxxx"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">水印设置</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">水印样式</label>
                <select
                  value={watermarkStyle}
                  onChange={e => setWatermarkStyle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {WATERMARK_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">水印位置</label>
                <select
                  value={watermarkPosition}
                  onChange={e => setWatermarkPosition(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {WATERMARK_POSITIONS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">品牌资源链接</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://..."
                />
                {logoUrl && (
                  <img src={logoUrl} alt="Logo preview" className="mt-2 h-12 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">二维码 URL</label>
                <input
                  type="url"
                  value={qrCodeUrl}
                  onChange={e => setQrCodeUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://..."
                />
                {qrCodeUrl && (
                  <img src={qrCodeUrl} alt="QR code preview" className="mt-2 h-20 w-20 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存品牌信息'}
            </button>
          </div>
        </form>
      </section>

      {/* Asset Upload */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">上传品牌资产</h2>
        <p className="text-sm text-gray-500 mb-4">
          上传认证文件、工厂照片、发货照等，作为生成图片时的素材或水印参考。先保存品牌信息后再上传资产。
        </p>
        <form onSubmit={handleUploadAsset} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">资产类型</label>
              <select
                value={uploadType}
                onChange={e => setUploadType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ASSET_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
              <input
                type="text"
                value={uploadDesc}
                onChange={e => setUploadDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="简短描述这个文件"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择文件</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              accept="image/*,.pdf"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? '上传中...' : '上传资产'}
            </button>
          </div>
        </form>
      </section>

      {/* Asset Library */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">品牌资料库</h2>
        {assets.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无资产，请先上传。</p>
        ) : (
          <div className="space-y-3">
            {assets.map(asset => (
              <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {asset.mime_type?.startsWith('image/') ? (
                    <img src={asset.file_url} alt={asset.file_name || ''} className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">PDF</div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">{asset.file_name}</div>
                    <div className="text-xs text-gray-500">
                      {ASSET_TYPES.find(t => t.value === asset.asset_type)?.label || asset.asset_type} · {formatFileSize(asset.file_size)}
                    </div>
                    {asset.description && <div className="text-xs text-gray-400 mt-0.5">{asset.description}</div>}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAsset(asset.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </WizardLayout>
  )
}