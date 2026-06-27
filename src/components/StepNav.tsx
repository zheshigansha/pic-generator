'use client'

import Link from 'next/link'

interface Step {
  id: number
  name: string
  path: string
}

const steps: Step[] = [
  { id: 1, name: '上传图片', path: '/upload' },
  { id: 2, name: '产品分析', path: '/analysis' },
  { id: 3, name: '场景设计', path: '/scene' },
  { id: 4, name: '生成图片', path: '/generate' },
  { id: 5, name: '审核发布', path: '/review' },
]

interface StepNavProps {
  currentStep: number
}

export default function StepNav({ currentStep }: StepNavProps) {
  return (
    <nav className="w-56 bg-gray-800 border-r border-gray-700 min-h-screen p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">VisionFit Pro</h1>
        <p className="text-xs text-gray-400">AI 服装模特图生成</p>
      </div>

      <ul className="space-y-1">
        <li>
          <Link
            href="/brand"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium bg-gray-600 text-white">
              ⚙
            </span>
            <span className="font-medium">品牌设置</span>
          </Link>
        </li>
      </ul>

      <div className="border-t border-gray-700 my-4" />

      <ul className="space-y-1">
        {steps.map((step) => {
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id

          return (
            <li key={step.id}>
              <Link
                href={step.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : isCompleted
                    ? 'text-green-400 hover:bg-gray-700'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                    isActive
                      ? 'bg-white text-blue-600'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  {isCompleted ? '✓' : step.id}
                </span>
                <span className="font-medium">{step.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="mt-8 p-4 bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-400">当前进度</p>
        <div className="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{currentStep} / {steps.length}</p>
      </div>
    </nav>
  )
}