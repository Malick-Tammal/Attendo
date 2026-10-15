import { useState, useEffect, useRef, useCallback } from "react"
import {
  Button,
  Spinner,
  TextField,
  Label,
  InputGroup,
  Alert,
  Chip,
  ProgressBar,
  Separator
} from "@heroui/react"
import {
  UserPlus,
  Camera,
  CheckCircle,
  AlertCircle,
  User,
  Briefcase,
  Mail,
  ScanFace
} from "lucide-react"
import { useWebcam } from "@renderer/hooks/useWebcam"

interface RegisterViewProps {
  setTab: (tab: string) => void
}

// ── Registration phase state machine ─────────────────────────────────────────
type Phase = "idle" | "capturing" | "success" | "error"

const TOTAL_SAMPLES = 5
const STEP_MS = 480 // ms per sample step in the animation

const SAMPLE_LABELS = [
  "Capturing reference photo…",
  "Processing lighting variation…",
  "Generating angle sample…",
  "Applying contrast profile…",
  "Finalising face gallery…"
]
// ─────────────────────────────────────────────────────────────────────────────

export function RegisterView({ setTab }: RegisterViewProps) {
  const { videoRef, isPlaying, startCamera, stopCamera } = useWebcam()
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const renderFrameId = useRef<number>(0)
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [formData, setFormData] = useState({ first_name: "", last_name: "", role: "", email: "" })

  const [phase, setPhase] = useState<Phase>("idle")
  const [currentSample, setCurrentSample] = useState(0) // 0–5
  const [errorMsg, setErrorMsg] = useState("")
  const [successDetail, setSuccessDetail] = useState("")

  // ── Camera lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // ── Oval framing guide ──────────────────────────────────────────────────────
  const renderLoop = useCallback(() => {
    const canvas = overlayCanvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !isPlaying) return

    canvas.width = video.clientWidth
    canvas.height = video.clientHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const rx = canvas.width * 0.22
    const ry = canvas.height * 0.38

    // Dim outside the oval
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"

    // Dashed ellipse border
    const isCapturing = phase === "capturing"
    ctx.strokeStyle = isCapturing
      ? "rgba(139, 92, 246, 0.85)" // purple while processing
      : "rgba(16, 185, 129, 0.7)" // green when idle/ready
    ctx.lineWidth = isCapturing ? 3 : 2
    ctx.setLineDash(isCapturing ? [4, 4] : [8, 6])
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    renderFrameId.current = requestAnimationFrame(renderLoop)
  }, [isPlaying, phase, videoRef])

  useEffect(() => {
    if (isPlaying) {
      renderFrameId.current = requestAnimationFrame(renderLoop)
    }
    return () => cancelAnimationFrame(renderFrameId.current)
  }, [isPlaying, renderLoop])

  // ── Cleanup step interval on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current)
    }
  }, [])

  // ── Submit handler ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessDetail("")

    if (!videoRef.current || !captureCanvasRef.current) {
      setErrorMsg("Camera is not ready")
      return
    }

    // Snapshot the current frame
    const video = videoRef.current
    const canvas = captureCanvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64Image = canvas.toDataURL("image/jpeg", 0.8)

    // Start the capture phase + step animation
    setPhase("capturing")
    setCurrentSample(0)

    // Animate step dots over TOTAL_SAMPLES × STEP_MS ms
    let step = 0
    const animationDone = new Promise<void>((resolve) => {
      stepIntervalRef.current = setInterval(() => {
        step++
        setCurrentSample(step)
        if (step >= TOTAL_SAMPLES) {
          clearInterval(stepIntervalRef.current!)
          stepIntervalRef.current = null
          resolve()
        }
      }, STEP_MS)
    })

    // Fire the HTTP request concurrently with the animation
    const fetchDone = fetch("http://127.0.0.1:8000/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, image: base64Image })
    }).then(async (res) => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to add employee")
      return data
    })

    try {
      // Wait for both animation and network to finish
      const [, data] = await Promise.all([animationDone, fetchDone])
      setSuccessDetail(data?.message ?? `${formData.first_name} registered successfully!`)
      setPhase("success")
      setFormData({ first_name: "", last_name: "", role: "", email: "" })
      setTimeout(() => setTab("dashboard"), 2500)
    } catch (err: unknown) {
      // Abort the animation if still running
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current)
        stepIntervalRef.current = null
      }
      setErrorMsg(err instanceof Error ? err.message : "Registration failed")
      setPhase("error")
    }
  }

  const isSubmitting = phase === "capturing"
  const barValue = Math.round((currentSample / TOTAL_SAMPLES) * 100)

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "var(--background)" }}>
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* ── Camera preview ───────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden" style={{ background: "var(--background)" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${isPlaying ? "opacity-100" : "opacity-0"}`}
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Camera loading */}
        {!isPlaying && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "color-mix(in oklch, var(--background) 90%, transparent)" }}
          >
            <Spinner size="lg" color="accent" />
            <p className="text-sm font-medium tracking-wide" style={{ color: "var(--muted)" }}>
              Starting camera…
            </p>
          </div>
        )}

        {/* Framing hint */}
        {isPlaying && phase === "idle" && (
          <div className="absolute bottom-5 left-0 right-0 flex justify-center">
            <div
              className="backdrop-blur-sm px-4 py-2 rounded-full text-xs tracking-wide"
              style={{
                background: "color-mix(in oklch, var(--background) 75%, transparent)",
                border: "1px solid var(--border)",
                color: "var(--muted)"
              }}
            >
              Align your face within the oval
            </div>
          </div>
        )}

        {/* Processing overlay on the camera preview */}
        {phase === "capturing" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ background: "color-mix(in oklch, var(--background) 55%, transparent)" }}
          >
            <ScanFace size={48} className="animate-pulse" style={{ color: "var(--accent)" }} />
            <p
              className="text-sm font-semibold tracking-wide backdrop-blur-sm px-3 py-1 rounded-full"
              style={{
                color: "var(--accent)",
                background: "color-mix(in oklch, var(--background) 70%, transparent)",
                border: "1px solid var(--border)"
              }}
            >
              {SAMPLE_LABELS[Math.min(currentSample, TOTAL_SAMPLES - 1)]}
            </p>
          </div>
        )}
      </div>

      {/* ── Registration form panel ──────────────────────────────────────── */}
      <div
        className="w-[400px] shrink-0 flex flex-col"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <header className="shrink-0 px-6 py-3.5 border-b border-separator bg-background/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-surface-secondary text-foreground">
              <UserPlus size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground leading-none">
                Register Employee
              </h2>
              <p className="text-[11px] text-muted mt-1 leading-none">
                Capture portrait &amp; credentials
              </p>
            </div>
          </div>
          <Chip size="sm" variant="soft" color="default" className="text-[10px] h-5">
            Face ID
          </Chip>
        </header>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 px-6 py-5 flex-1 overflow-y-auto"
        >
          {/* ── Status alerts ──────────────────────────────────────────── */}
          {phase === "error" && errorMsg && (
            <Alert status="danger">
              <Alert.Indicator>
                <AlertCircle size={16} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Registration Failed</Alert.Title>
                <Alert.Description>{errorMsg}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {phase === "success" && (
            <Alert status="success">
              <Alert.Indicator>
                <CheckCircle size={16} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Registered</Alert.Title>
                <Alert.Description>{successDetail}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {/* ── Form fields ────────────────────────────────────────────── */}
          <div className="w-full grid grid-cols-2 gap-3 min-w-0">
            <TextField
              fullWidth
              isRequired
              className="min-w-0"
              value={formData.first_name}
              onChange={(val) => setFormData((f) => ({ ...f, first_name: val }))}
            >
              <Label>First Name</Label>
              <InputGroup variant="secondary" fullWidth className="min-w-0">
                <InputGroup.Prefix>
                  <User size={15} className="text-muted shrink-0" />
                </InputGroup.Prefix>
                <InputGroup.Input placeholder="Mohamed" className="min-w-0" />
              </InputGroup>
            </TextField>

            <TextField
              fullWidth
              isRequired
              className="min-w-0"
              value={formData.last_name}
              onChange={(val) => setFormData((f) => ({ ...f, last_name: val }))}
            >
              <Label>Last Name</Label>
              <InputGroup variant="secondary" fullWidth className="min-w-0">
                <InputGroup.Prefix>
                  <User size={15} className="text-muted shrink-0" />
                </InputGroup.Prefix>
                <InputGroup.Input placeholder="Lamjed" className="min-w-0" />
              </InputGroup>
            </TextField>
          </div>

          <TextField
            fullWidth
            isRequired
            value={formData.role}
            onChange={(val) => setFormData((f) => ({ ...f, role: val }))}
          >
            <Label>Job Role</Label>
            <InputGroup variant="secondary" fullWidth>
              <InputGroup.Prefix>
                <Briefcase size={15} className="text-muted shrink-0" />
              </InputGroup.Prefix>
              <InputGroup.Input placeholder="Software Engineer" className="min-w-0" />
            </InputGroup>
          </TextField>

          <TextField
            fullWidth
            isRequired
            value={formData.email}
            onChange={(val) => setFormData((f) => ({ ...f, email: val }))}
          >
            <Label>Email Address</Label>
            <InputGroup variant="secondary" fullWidth>
              <InputGroup.Prefix>
                <Mail size={15} className="text-muted shrink-0" />
              </InputGroup.Prefix>
              <InputGroup.Input type="email" placeholder="name@company.com" className="min-w-0" />
            </InputGroup>
          </TextField>

          {/* ── Submit + progress ──────────────────────────────────────── */}
          <div className="mt-auto pt-2 flex flex-col gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isDisabled={isSubmitting || !isPlaying || phase === "success"}
              className="flex items-center justify-center gap-2 font-semibold tracking-wide"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" color="current" />
                  Registering…
                </>
              ) : (
                <>
                  <Camera size={16} />
                  Capture &amp; Register
                </>
              )}
            </Button>

            <Separator className="my-4" />

            {/* 5-sample progress — always visible; grayed-out when idle */}
            {(() => {
              const idle = phase === "idle" || phase === "error"
              return (
                <div
                  className="flex flex-col gap-3 px-4 py-3 rounded-xl transition-all duration-300"
                  style={{
                    background: idle
                      ? "color-mix(in oklch, var(--foreground) 4%, transparent)"
                      : "color-mix(in oklch, var(--accent) 6%, transparent)",
                    border: `1px solid ${
                      idle
                        ? "color-mix(in oklch, var(--foreground) 10%, transparent)"
                        : "color-mix(in oklch, var(--accent) 18%, transparent)"
                    }`,
                    opacity: idle ? 0.55 : 1
                  }}
                >
                  {/* Step dots */}
                  <div className="flex items-center justify-between gap-1.5">
                    {Array.from({ length: TOTAL_SAMPLES }).map((_, i) => {
                      const done = i < currentSample
                      const active = !idle && i === currentSample
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300"
                            style={{
                              background: done
                                ? "var(--success)"
                                : active
                                  ? "var(--accent)"
                                  : "color-mix(in oklch, var(--foreground) 10%, transparent)",
                              color: done || active ? "#fff" : "var(--muted)",
                              boxShadow: active
                                ? "0 0 0 3px color-mix(in oklch, var(--accent) 25%, transparent)"
                                : "none",
                              transform: active ? "scale(1.15)" : "scale(1)"
                            }}
                          >
                            {done ? "✓" : i + 1}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Connector lines between dots */}
                  <div className="flex items-center gap-0 -mt-1 px-3.5">
                    {Array.from({ length: TOTAL_SAMPLES - 1 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 h-px transition-all duration-500"
                        style={{
                          background:
                            i < currentSample - 1
                              ? "var(--success)"
                              : i === currentSample - 1
                                ? `linear-gradient(to right, var(--success), color-mix(in oklch, var(--foreground) 12%, transparent))`
                                : "color-mix(in oklch, var(--foreground) 12%, transparent)"
                        }}
                      />
                    ))}
                  </div>

                  {/* Progress bar */}
                  <ProgressBar
                    aria-label="Registration progress"
                    value={barValue}
                    color={barValue === 100 ? "success" : idle ? "default" : "accent"}
                    size="sm"
                  >
                    <ProgressBar.Track>
                      <ProgressBar.Fill style={{ transition: "width 450ms ease-in-out" }} />
                    </ProgressBar.Track>
                  </ProgressBar>

                  {/* Step label */}
                  <p
                    className="text-[11px] text-center font-medium tracking-wide"
                    style={{ color: idle ? "var(--muted)" : "var(--accent)" }}
                  >
                    {idle ? (
                      "5 face samples will be captured on register"
                    ) : (
                      <>
                        {SAMPLE_LABELS[Math.min(currentSample, TOTAL_SAMPLES - 1)]}
                        &nbsp;
                        <span style={{ color: "var(--muted)" }}>
                          ({Math.min(currentSample + 1, TOTAL_SAMPLES)}/{TOTAL_SAMPLES})
                        </span>
                      </>
                    )}
                  </p>
                </div>
              )
            })()}

            {!isPlaying && phase === "idle" && (
              <p className="text-center text-xs" style={{ color: "var(--muted)" }}>
                Waiting for camera…
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterView
