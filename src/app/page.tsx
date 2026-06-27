import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold">VisionFit Pro</h1>
          <p className="text-sm text-gray-400">AI 服装模特图生成系统</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            上传 · 分析 · 生成 · 审核 · 发布
          </h2>
          <p className="text-xl text-gray-300">
            将服装图片转换为专业模特图，一站式 AI 生成与发布
          </p>
        </div>

        {/* Workflow Steps */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-300">主工作流</h3>
          <div className="grid md:grid-cols-5 gap-4 mb-4">
          {[
            { num: 1, name: '上传图片', desc: '上传服装多角度图', href: '/upload', color: 'blue' },
            { num: 2, name: '产品分析', desc: 'AI 分析服装细节', href: '/analysis', color: 'purple' },
            { num: 3, name: '场景设计', desc: '选择/设计场景', href: '/scene', color: 'yellow' },
            { num: 4, name: '生成图片', desc: 'AI 生成模特图', href: '/generate', color: 'pink' },
            { num: 5, name: '审核发布', desc: '选择并发布', href: '/review', color: 'green' },
          ].map((step) => (
            <div
              key={step.num}
              className={`bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:border-${step.color}-500 transition-colors text-center`}
            >
              <div className={`w-10 h-10 bg-${step.color}-600 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3`}>
                {step.num}
              </div>
              <h3 className="text-lg font-semibold mb-1">{step.name}</h3>
              <p className="text-sm text-gray-400 mb-3">{step.desc}</p>
              <Link
                href={step.href}
                className={`inline-block bg-${step.color}-600/20 hover:bg-${step.color}-600/30 text-${step.color}-400 px-4 py-1.5 rounded-lg text-sm transition-colors`}
              >
                进入 →
              </Link>
            </div>
          ))}
        </div>

        {/* Brand Settings */}
        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">品牌设置</h3>
          <p className="text-sm text-gray-400 mb-4">配置品牌信息、资质文件、联系方式，用于生成图片时嵌入品牌水印。</p>
          <Link
            href="/brand"
            className="inline-block bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            进入品牌设置 →
          </Link>
        </div>

        {/* Quick Info */}
        <div className="bg-gray-800/30 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">工作流程</h3>
          <ol className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-blue-400 font-bold">1.</span>
              <span>上传同一服装的多角度图片（最多20张）</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-purple-400 font-bold">2.</span>
              <span>AI 分析服装细节（颜色、材质、款式、领型、袖长等），可手动调整</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 font-bold">3.</span>
              <span>选择场景（咖啡厅、街道、办公室等），设置季节、环境、主体</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-pink-400 font-bold">4.</span>
              <span>AI 根据配置生成多张模特图</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 font-bold">5.</span>
              <span>审核图片，选择封面，发布到 Facebook / Instagram 或下载</span>
            </li>
          </ol>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 mt-12 py-6 text-center text-gray-500 text-sm">
        VisionFit Pro — AI 服装模特图生成系统
      </footer>
    </div>
  )
}