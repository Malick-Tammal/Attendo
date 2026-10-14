import { useState, useRef, useCallback } from "react"

export function useWebcam() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)

  const startCamera = useCallback(async () => {
    try {
      setErrorMsg("")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsPlaying(true)
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setErrorMsg("Failed to access camera.")
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setIsPlaying(false)
    }
  }, [])

  return { videoRef, isPlaying, errorMsg, startCamera, stopCamera }
}
