import { Button, Spinner } from "@heroui/react"
import { Play, Square } from "lucide-react"

interface ControlBarProps {
  isPlaying: boolean
  isModelLoading: boolean
  onStart: () => void
  onStop: () => void
}

export function ControlBar({ isPlaying, isModelLoading, onStart, onStop }: ControlBarProps) {
  return (
    <div
      className="shrink-0 px-6 py-4 backdrop-blur-sm flex items-center justify-center gap-4"
      style={{
        borderTop: "1px solid var(--border)",
        background: "color-mix(in oklch, var(--background) 80%, transparent)"
      }}
    >
      {isModelLoading ? (
        <div className="flex items-center gap-3" style={{ color: "var(--muted)" }}>
          <Spinner size="sm" color="accent" />
          <span className="text-sm font-medium">Loading AI model…</span>
        </div>
      ) : isPlaying ? (
        <Button
          variant="danger-soft"
          size="md"
          onPress={onStop}
          className="font-semibold tracking-wide flex items-center gap-2"
        >
          <Square size={15} fill="currentColor" />
          Stop Camera
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          onPress={onStart}
          className="font-semibold tracking-wide flex items-center gap-2"
        >
          <Play size={15} fill="currentColor" />
          Start Camera
        </Button>
      )}
    </div>
  )
}
