'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setupMissing = searchParams.get('setup') === '1'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '登录失败')
      }

      router.replace(searchParams.get('next') || '/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-1">VisionFit Pro</h1>
        <p className="text-sm text-gray-400 mb-6">内部访问验证</p>

        {setupMissing ? (
          <div className="mb-4 rounded border border-yellow-700 bg-yellow-900/30 p-3 text-sm text-yellow-200">
            生产环境需要配置 APP_ACCESS_PASSWORD 和 APP_SESSION_SECRET。
          </div>
        ) : null}

        <label className="block text-sm text-gray-300 mb-2" htmlFor="password">
          访问口令
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          className="w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 outline-none focus:border-blue-500"
          autoComplete="current-password"
        />

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || setupMissing}
          className="mt-5 w-full rounded bg-blue-600 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:bg-gray-700"
        >
          {loading ? '验证中...' : '进入'}
        </button>
      </form>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}