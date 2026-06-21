'use client'

import StepNav from './StepNav'
import { ProjectProvider } from './ProjectContext'

export default function WizardLayout({
  children,
  currentStep,
}: {
  children: React.ReactNode
  currentStep: number
}) {
  return (
    <ProjectProvider>
      <div className="flex min-h-screen bg-gray-900">
        <StepNav currentStep={currentStep} />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </ProjectProvider>
  )
}