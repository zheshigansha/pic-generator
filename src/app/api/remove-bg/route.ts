import { NextRequest, NextResponse } from 'next/server'
import { getClientKey, rateLimit } from '@/lib/rate-limit'
import { uploadToStorage } from '@/lib/supabase'

const MAX_SIZE = 10 * 1024 * 1024  // 10MB
const PYTHON_SCRIPT = 'D:\\00个人业务\\08生财有术\\00-00-03AI航海俱乐部\\00Hermes\\vision-fit-pro\\scripts\\remove_bg.py'
const PYTHON = 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python313\\python.exe'

function isValidBase64Image(data: string): boolean {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(data) && data.length <= MAX_SIZE * 2
}

function base64ToBuffer(data: string): Buffer {
  const base64 = data.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64, 'base64')
}

async function runPythonScript(inputPath: string, outputPath: string): Promise<string> {
  const { execFile } = await import('child_process')

  return new Promise((resolve, reject) => {
    const child = execFile(
      PYTHON,
      [PYTHON_SCRIPT, inputPath, outputPath],
      { timeout: 60000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Script error: ${stderr || error.message}`))
          return
        }
        const line = stdout.trim()
        if (line.startsWith('SUCCESS:')) {
          resolve(line.slice(8))
        } else if (line.startsWith('ERROR:')) {
          reject(new Error(line.slice(6)))
        } else {
          reject(new Error(`Unexpected output: ${stdout}`))
        }
      }
    )
  })
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(getClientKey(request, 'analyze'), 20, 60_000)
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } }
    )
  }

  try {
    const { imageData, projectId, itemId } = await request.json()

    if (!imageData || !isValidBase64Image(imageData)) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
    }

    if (!projectId || !itemId) {
      return NextResponse.json({ error: 'Missing projectId or itemId' }, { status: 400 })
    }

    // Create a unique working directory for this operation
    const workDir = `${process.env.TEMP || 'C:\\Windows\\Temp'}/remove-bg-${Date.now()}`
    const { mkdir } = await import('fs/promises')
    await mkdir(workDir, { recursive: true })

    try {
      // Save input image
      const inputBuffer = base64ToBuffer(imageData)
      const inputPath = `${workDir}/input.png`
      const { writeFile } = await import('fs/promises')
      await writeFile(inputPath, inputBuffer)

      // Run background removal
      const outputPath = `${workDir}/output.png`
      await runPythonScript(inputPath, outputPath)

      // Read result
      const resultBuffer = await import('fs/promises').then(m => m.readFile(outputPath))
      const resultBase64 = `data:image/png;base64,${resultBuffer.toString('base64')}`

      // Convert Buffer to Blob for storage upload
      const resultBlob = new Blob([resultBuffer], { type: 'image/png' })
      const processedPath = `${projectId}/${itemId}_processed_${Date.now()}.png`
      let processedUrl: string | null = null

      try {
        processedUrl = await uploadToStorage('clothing-images', resultBlob, processedPath)
      } catch (e) {
        console.warn('Failed to upload processed image to Storage:', e)
      }

      // Clean up temp files
      await import('fs/promises').then(m => m.rm(workDir, { recursive: true, force: true }))

      return NextResponse.json({
        processedImageData: resultBase64,
        processedImageUrl: processedUrl,
        originalProjectId: projectId,
        itemId,
      })
    } catch (cleanupError) {
      // Try to clean up even on error
      try {
        await import('fs/promises').then(m => m.rm(workDir, { recursive: true, force: true }))
      } catch {}
      throw cleanupError
    }
  } catch (error) {
    console.error('Remove-bg API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Background removal failed' },
      { status: 500 }
    )
  }
}
