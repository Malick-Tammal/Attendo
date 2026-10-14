export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
}

export interface TrackedFace {
  id: string
  box: FaceBox
  name: string
  role: string
  accessGranted: boolean
  lastSeen: number
  showAccessBadge?: boolean
  badgeExpiry?: number
}
