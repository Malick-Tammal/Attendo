import { useEffect, useRef, useCallback } from "react"
import type { FaceRecognitionResult } from "../types"

export function useAIWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const isNetworkProcessing = useRef(false)
  const knownFacesRef = useRef<Map<string, FaceRecognitionResult>>(new Map())

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:8000/ws")

      ws.onopen = () => {
        console.log("Connected to AI Backend")
        isNetworkProcessing.current = false
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.results) {
          data.results.forEach((res: FaceRecognitionResult) => {
            knownFacesRef.current.set(res.id, {
              id: res.id,
              name: res.name,
              role: res.role,
              accessGranted: res.accessGranted,
              justLogged: res.justLogged
            })
          })
        }
        isNetworkProcessing.current = false
      }

      ws.onerror = (err) => {
        console.error("WebSocket Error:", err)
        isNetworkProcessing.current = false
      }

      ws.onclose = () => {
        console.log("WebSocket closed, reconnecting...")
        isNetworkProcessing.current = false
        reconnectTimeout = setTimeout(connectWS, 3000)
      }

      wsRef.current = ws
    }

    connectWS()

    return () => {
      clearTimeout(reconnectTimeout)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  const sendCroppedFaces = useCallback((payloads: { id: string; image: string }[]) => {
    if (isNetworkProcessing.current || payloads.length === 0) return

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      isNetworkProcessing.current = true
      wsRef.current.send(JSON.stringify({ faces: payloads }))
    }
  }, [])

  return { knownFacesRef, sendCroppedFaces }
}
