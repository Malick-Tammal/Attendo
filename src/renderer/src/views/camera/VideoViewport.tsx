import { useRef, useEffect } from "react"
import type { RefObject } from "react"
import type { FaceDetector } from "@mediapipe/tasks-vision"
import { Spinner, Alert } from "@heroui/react"
import { Camera, CameraOff } from "lucide-react"
import { useAIWebSocket } from "@renderer/hooks/useAIWebSocket"
import { cropFaceAsBase64 } from "@renderer/utils/cameraUtils"
import type { TrackedFace } from "@renderer/types"

interface VideoViewportProps {
  videoRef: RefObject<HTMLVideoElement | null>
  faceDetectorRef: RefObject<FaceDetector | null>
  isPlaying: boolean
  isModelLoading: boolean
  errorMsg: string
}

export function VideoViewport({
  videoRef,
  faceDetectorRef,
  isPlaying,
  isModelLoading,
  errorMsg
}: VideoViewportProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const { knownFacesRef, sendCroppedFaces } = useAIWebSocket()

  useEffect(() => {
    if (!isPlaying || isModelLoading) return

    const renderLoop = () => {
      const video = videoRef.current
      const canvas = overlayCanvasRef.current
      const cropCanvas = cropCanvasRef.current

      if (!video || !canvas || !cropCanvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(renderLoop)
        return
      }

      canvas.width = video.clientWidth
      canvas.height = video.clientHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(renderLoop)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const scaleX = canvas.width / video.videoWidth
      const scaleY = canvas.height / video.videoHeight
      const detector = faceDetectorRef.current

      if (detector) {
        const result = detector.detectForVideo(video, performance.now())
        const detections = result.detections ?? []

        // ── Prune stale entries from knownFacesRef ────────────────────────
        for (const key of knownFacesRef.current.keys()) {
          if (Number(key) >= detections.length) {
            knownFacesRef.current.delete(key)
          }
        }

        // ── Build payloads using STABLE index-based IDs ───────────────────
        const payloads: { id: string; image: string }[] = []
        detections.forEach((det, index) => {
          const bb = det.boundingBox
          if (!bb) return
          const face: TrackedFace = {
            id: String(index),
            box: { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height },
            name: "",
            role: "",
            accessGranted: false,
            lastSeen: Date.now()
          }
          const b64 = cropFaceAsBase64(video, cropCanvas, face)
          if (b64) payloads.push({ id: face.id, image: b64 })
        })

        if (payloads.length > 0) sendCroppedFaces(payloads)

        // ── Draw overlay for each detected face ───────────────────────────
        detections.forEach((det, index) => {
          const bb = det.boundingBox
          if (!bb) return

          const info = knownFacesRef.current.get(String(index))
          const granted = info?.accessGranted ?? false

          const x = bb.originX * scaleX
          const y = bb.originY * scaleY
          const w = bb.width * scaleX
          const h = bb.height * scaleY

          const color = granted ? "#10b981" : "#ef4444"
          const glowColor = granted ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"

          // Glow
          ctx.shadowColor = glowColor
          ctx.shadowBlur = 18
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, w, h)
          ctx.shadowBlur = 0

          // Corner accents
          const cs = 14
          ctx.strokeStyle = color
          ctx.lineWidth = 3
          ;(
            [
              [x, y, cs, 0, 0, cs],
              [x + w, y, -cs, 0, 0, cs],
              [x, y + h, cs, 0, 0, -cs],
              [x + w, y + h, -cs, 0, 0, -cs]
            ] as [number, number, number, number, number, number][]
          ).forEach(([cx, cy, dx1, _, dx2, dy2]) => {
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(cx + dx1, cy)
            ctx.moveTo(cx, cy)
            ctx.lineTo(cx + dx2, cy + dy2)
            ctx.stroke()
          })

          // Label
          const name = info?.name ?? "Analyzing..."
          const role = info?.role ?? ""
          const label = info ? `${name}  •  ${role}` : name

          ctx.font = "bold 12px Inter, sans-serif"
          const textW = ctx.measureText(label).width
          const padX = 10,
            labelH = 24
          const lx = x
          const ly = Math.max(0, y - labelH - 6)

          ctx.fillStyle = granted ? "rgba(16,185,129,0.88)" : "rgba(239,68,68,0.88)"
          ctx.beginPath()
          ctx.roundRect(lx, ly, textW + padX * 2, labelH, 4)
          ctx.fill()

          ctx.fillStyle = "#fff"
          ctx.fillText(label, lx + padX, ly + 16)
        })
      }

      animFrameRef.current = requestAnimationFrame(renderLoop)
    }

    animFrameRef.current = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, isModelLoading, faceDetectorRef, sendCroppedFaces, knownFacesRef, videoRef])

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* Hidden crop canvas — never painted, used only for toDataURL() */}
      <canvas ref={cropCanvasRef} className="hidden" />

      {/* Live video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${isPlaying ? "opacity-100" : "opacity-0"}`}
      />

      {/* Detection overlay */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Loading overlay — model download/init */}
      {isModelLoading && !errorMsg && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4"
          style={{ background: "color-mix(in oklch, var(--background) 90%, transparent)" }}
        >
          <Spinner size="lg" color="accent" />
          <p className="text-sm font-medium tracking-wide" style={{ color: "var(--muted)" }}>
            Loading AI model…
          </p>
        </div>
      )}

      {/* Camera idle overlay — model ready but user hasn't started yet */}
      {!isPlaying && !isModelLoading && !errorMsg && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "color-mix(in oklch, var(--background) 90%, transparent)" }}
        >
          <div className="w-full max-w-sm px-6">
            <Alert status="default">
              <Alert.Indicator>
                <Camera size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Camera is off</Alert.Title>
                <Alert.Description>Press Start to begin face detection.</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {errorMsg && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "color-mix(in oklch, var(--background) 90%, transparent)" }}
        >
          <div className="w-full max-w-sm px-6">
            <Alert status="danger">
              <Alert.Indicator>
                <CameraOff size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Camera Error</Alert.Title>
                <Alert.Description>{errorMsg}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        </div>
      )}

      {/* Live badge */}
      {isPlaying && !isModelLoading && (
        <div
          className="absolute top-4 left-4 flex items-center gap-2 backdrop-blur-sm px-3 py-1.5 rounded-full"
          style={{
            background: "color-mix(in oklch, var(--background) 70%, transparent)",
            border: "1px solid var(--border)"
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ background: "var(--success)" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: "var(--success)" }}
            />
          </span>
          <span
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--success)" }}
          >
            Live
          </span>
        </div>
      )}
    </div>
  )
}
