/**
 * Copies MediaPipe WASM runtime files from node_modules into the renderer's
 * public directory, and downloads the BlazeFace tflite model if not already
 * present. Runs automatically via the postinstall npm hook.
 *
 * After this script, all MediaPipe assets are served locally — no CDN or
 * internet access required at runtime.
 */

import { cpSync, existsSync, mkdirSync } from "fs"
import { createWriteStream } from "fs"
import { get as httpsGet } from "https"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")

const WASM_SRC = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm")
const WASM_DEST = resolve(root, "src/renderer/public/mediapipe/wasm")
const MODEL_DEST = resolve(root, "src/renderer/public/mediapipe/blaze_face_short_range.tflite")
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"

// ── 1. Copy WASM files ────────────────────────────────────────────────────────
mkdirSync(WASM_DEST, { recursive: true })
cpSync(WASM_SRC, WASM_DEST, { recursive: true })
console.log(`[mediapipe] Copied WASM runtime → ${WASM_DEST}`)

// ── 2. Download tflite model (skip if already cached) ────────────────────────
if (existsSync(MODEL_DEST)) {
  console.log("[mediapipe] Model already present, skipping download.")
  process.exit(0)
}

console.log("[mediapipe] Downloading BlazeFace model…")

const file = createWriteStream(MODEL_DEST)
httpsGet(MODEL_URL, (res) => {
  if (res.statusCode === 301 || res.statusCode === 302) {
    // Follow redirect
    file.close()
    httpsGet(res.headers.location, (res2) => {
      res2.pipe(file)
      file.on("finish", () => {
        file.close()
        console.log(`[mediapipe] Model downloaded → ${MODEL_DEST}`)
      })
    }).on("error", bail)
    return
  }
  if (res.statusCode !== 200) {
    bail(new Error(`HTTP ${res.statusCode}`))
    return
  }
  res.pipe(file)
  file.on("finish", () => {
    file.close()
    console.log(`[mediapipe] Model downloaded → ${MODEL_DEST}`)
  })
}).on("error", bail)

function bail(err) {
  file.close()
  try {
    require("fs").unlinkSync(MODEL_DEST)
  } catch (_) {}
  console.error("[mediapipe] Download failed:", err.message)
  process.exit(1)
}
