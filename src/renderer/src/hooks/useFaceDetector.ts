import { useState, useRef, useEffect } from "react"
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision"

export function useFaceDetector() {
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [modelErrorMsg, setModelErrorMsg] = useState("")
  const faceDetectorRef = useRef<FaceDetector | null>(null)

  useEffect(() => {
    let isMounted = true

    const initDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          // Served from public/mediapipe/wasm — no CDN required at runtime.
          // Assets are copied from node_modules by scripts/copy-mediapipe.mjs (postinstall).
          "./mediapipe/wasm"
        )
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "./mediapipe/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO"
        })

        if (isMounted) {
          faceDetectorRef.current = detector
          setIsModelLoading(false)
          console.log("MediaPipe Model Loaded")
        }
      } catch (err) {
        console.error("Failed to load MediaPipe model:", err)
        if (isMounted) {
          setModelErrorMsg("Failed to load AI model. Check internet connection.")
          setIsModelLoading(false)
        }
      }
    }

    initDetector()

    return () => {
      isMounted = false
    }
  }, [])

  return { faceDetectorRef, isModelLoading, modelErrorMsg }
}
