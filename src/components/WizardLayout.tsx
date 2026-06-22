'use client'

import StepNav from './StepNav'

export default function WizardLayout({
  children,
  currentStep,
}: {
  children: React.ReactNode
  currentStep: number
}) {
  return (
    <div className="flex min-h-screen bg-gray-900">
      <StepNav currentStep={currentStep} />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}