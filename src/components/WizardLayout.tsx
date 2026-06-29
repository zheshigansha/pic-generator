'use client'

import StepNav from './StepNav'

export default function WizardLayout({
  children,
  currentStep,
  title,
  description,
}: {
  children: React.ReactNode
  currentStep: number
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-screen bg-gray-900">
      <StepNav currentStep={currentStep} />
      <main className="flex-1 p-8">
        {title && <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>}
        {description && <p className="text-gray-400 mb-6">{description}</p>}
        {children}
      </main>
    </div>
  )
}