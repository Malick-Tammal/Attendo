import { useState, useEffect, useRef, useCallback } from "react"
import { Button, Spinner, TextField, Label, InputGroup, Alert, Chip } from "@heroui/react"
import { UserPlus, Camera, CheckCircle, AlertCircle, User, Briefcase, Mail } from "lucide-react"
import { useWebcam } from "@renderer/hooks/useWebcam"

interface RegisterViewProps {
  setTab: (tab: string) => void
}

export function RegisterView({ setTab }: RegisterViewProps) {
  const { videoRef, isPlaying, startCamera, stopCamera } = useWebcam()
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const renderFrameId = useRef<number>(0)

  const [formData, setFormData] = useState({ first_name: "", last_name: "", role: "", email: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // Oval framing guide
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

    // Dim outside
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"

    // Ellipse border — uses --success green
    ctx.strokeStyle = "rgba(16, 185, 129, 0.7)"
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    renderFrameId.current = requestAnimationFrame(renderLoop)
  }, [isPlaying, videoRef])

  useEffect(() => {
    if (isPlaying) {
      renderFrameId.current = requestAnimationFrame(renderLoop)
    }
    return () => cancelAnimationFrame(renderFrameId.current)
  }, [isPlaying, renderLoop])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")

    if (!videoRef.current || !captureCanvasRef.current) {
      setErrorMsg("Camera is not ready")
      return
    }

    const video = videoRef.current
    const canvas = captureCanvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64Image = canvas.toDataURL("image/jpeg", 0.8)

    setIsSubmitting(true)
    try {
      const response = await fetch("http://127.0.0.1:8000/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, image: base64Image })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || "Failed to add employee")

      setSuccessMsg(`${formData.first_name} registered successfully!`)
      setFormData({ first_name: "", last_name: "", role: "", email: "" })
      setTimeout(() => setTab("dashboard"), 2000)
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

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

        {isPlaying && (
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
      </div>

      {/* ── Registration form ────────────────────────────────────────────── */}
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
          {errorMsg && (
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

          {successMsg && (
            <Alert status="success">
              <Alert.Indicator>
                <CheckCircle size={16} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Registered</Alert.Title>
                <Alert.Description>{successMsg}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

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
              <InputGroup.Input type="email" placeholder="mohamed@gmail.com" className="min-w-0" />
            </InputGroup>
          </TextField>

          <div className="mt-auto pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              isDisabled={isSubmitting || !isPlaying}
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
            {!isPlaying && (
              <p className="text-center text-xs mt-2" style={{ color: "var(--muted)" }}>
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
