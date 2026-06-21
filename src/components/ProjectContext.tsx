'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface Project {
  id: string
  name: string
  status: string
}

interface ProjectContextType {
  project: Project | null
  loading: boolean
  createNewProject: (name: string) => Promise<Project>
  refreshProject: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | null>(null)

const PROJECT_ID_KEY = 'visionfit_project_id'

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProject = async (projectId: string) => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) {
      console.error('Failed to load project:', error)
      return null
    }
    return data
  }

  const createNewProject = async (name: string): Promise<Project> => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, status: 'uploaded' })
      .select()
      .single()

    if (error) throw error

    localStorage.setItem(PROJECT_ID_KEY, data.id)
    setProject(data)
    return data
  }

  const refreshProject = async () => {
    const projectId = localStorage.getItem(PROJECT_ID_KEY)
    if (!projectId) {
      setLoading(false)
      return
    }

    const data = await loadProject(projectId)
    if (data) {
      setProject(data)
    } else {
      localStorage.removeItem(PROJECT_ID_KEY)
    }
    setLoading(false)
  }

  useEffect(() => {
    refreshProject()
  }, [])

  return (
    <ProjectContext.Provider value={{ project, loading, createNewProject, refreshProject }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider')
  }
  return context
}