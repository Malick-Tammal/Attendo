import { join } from "path"
import { spawn, ChildProcess } from "child_process"

let pythonProcess: ChildProcess | null = null
let restartCount: number = 0
let isQuitting: boolean = false

const MAX_RESTARTS = 5
const RESTART_DELAY_MS = 2000

export function startPythonBackend(): void {
  const backendPath = join(__dirname, "../../backend")
  const pythonExecutable = join(backendPath, "venv/bin/python")
  const scriptPath = join(backendPath, "main.py")

  const proc = spawn(pythonExecutable, [scriptPath], {
    cwd: backendPath,
    detached: false
  })

  proc.stdout?.on("data", (data) => {
    console.log(`[Python] ${data.toString().trim()}`)
  })

  proc.stderr?.on("data", (data) => {
    console.error(`[Python Error] ${data.toString().trim()}`)
  })

  proc.on("close", (code) => {
    pythonProcess = null

    // Don't restart if Electron is quitting or the process exited cleanly (code 0)
    if (isQuitting || code === 0) return

    if (restartCount < MAX_RESTARTS) {
      restartCount++
      console.warn(
        `[Python] Process exited with code ${code}. Restarting in ${RESTART_DELAY_MS}ms… (attempt ${restartCount}/${MAX_RESTARTS})`
      )
      setTimeout(startPythonBackend, RESTART_DELAY_MS)
    } else {
      console.error(
        `[Python] Backend crashed ${MAX_RESTARTS} times. Giving up — check MongoDB and backend logs.`
      )
    }
  })

  pythonProcess = proc
}

export function stopPythonBackend(): void {
  isQuitting = true
  if (pythonProcess) {
    pythonProcess.kill()
  }
}
