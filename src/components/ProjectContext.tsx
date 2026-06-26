'use client'

import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react'
import { createProject, getProject } from '@/lib/db'

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

  const loadProject = useCallback(async (projectId: string) => {
    try {
      return await getProject(projectId) as Project
    } catch (error) {
      console.error('Failed to load project:', error)
      return null
    }
  }, [])

  const createNewProject = useCallback(async (name: string): Promise<Project> => {
    const data = await createProject(name) as Project
    localStorage.setItem(PROJECT_ID_KEY, data.id)
    setProject(data)
    return data
  }, [])

  const refreshProject = useCallback(async () => {
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
  }, [createNewProject, loadProject])

  useEffect(() => {
    // Project state is bootstrapped from localStorage and the database once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProject()
  }, [refreshProject])

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
