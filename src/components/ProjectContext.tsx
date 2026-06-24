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
    if (projectId) {
      const data = await loadProject(projectId)
      if (data) {
        setProject(data)
        setLoading(false)
        return
      }
      // Project not found in DB, clear stale ID
      localStorage.removeItem(PROJECT_ID_KEY)
    }

    // No project exists — create one automatically
    try {
      const newProject = await createNewProject('New Project')
      setProject(newProject)
    } catch (e) {
      console.error('Failed to create project:', e)
      // Still set loading false so UI doesn't hang
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
  // Return a safe default during SSR/prerendering
  if (!context) {
    return {
      project: null,
      loading: true,
      createNewProject: async () => { throw new Error('ProjectContext not initialized') },
      refreshProject: async () => {},
    }
  }
  return context
}