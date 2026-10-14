import { useState, useEffect } from 'react'

const API = 'http://127.0.0.1:8000'
const POLL_INTERVAL_MS = 5000

export type DbStatus = 'online' | 'offline' | 'checking'

export function useDbHealth(): DbStatus {
  const [status, setStatus] = useState<DbStatus>('checking')

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`${API}/health`)
        const data = await res.json()
        if (!cancelled) setStatus(data.db === 'online' ? 'online' : 'offline')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return status
}
