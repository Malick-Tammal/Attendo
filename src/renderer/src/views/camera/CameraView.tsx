import { useEffect } from "react"
import { useWebcam } from "@renderer/hooks/useWebcam"
import { useFaceDetector } from "@renderer/hooks/useFaceDetector"
import { VideoViewport } from "./VideoViewport"
import { ControlBar } from "./ControlBar"

export function CameraView(): React.JSX.Element {
  const { videoRef, isPlaying, errorMsg: webcamError, startCamera, stopCamera } = useWebcam()
  const { faceDetectorRef, isModelLoading, modelErrorMsg } = useFaceDetector()

  const combinedErrorMsg = webcamError || modelErrorMsg

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* ── Camera area: fills remaining height, centers the 16:9 viewport ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <div
          className="w-[70%] aspect-video max-h-full rounded-2xl overflow-hidden shadow-2xl shadow-black/60 flex flex-col"
          style={{ border: "1px solid var(--border)" }}
        >
          <VideoViewport
            videoRef={videoRef}
            faceDetectorRef={faceDetectorRef}
            isPlaying={isPlaying}
            isModelLoading={isModelLoading}
            errorMsg={combinedErrorMsg}
          />
        </div>
      </div>

      {/* ── Bottom control bar ─────────────────────────────────────────────── */}
      <ControlBar
        isPlaying={isPlaying}
        isModelLoading={isModelLoading}
        onStart={startCamera}
        onStop={stopCamera}
      />
    </div>
  )
}

export default CameraView
