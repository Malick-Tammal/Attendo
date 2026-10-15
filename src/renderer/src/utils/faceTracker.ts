/**
 * Lightweight IoU + centroid-distance face tracker.
 *
 * Runs entirely on the renderer (pure TS, no dependencies).
 * On every frame it matches new MediaPipe detections against the previous
 * frame's tracks via IoU, with a centroid-distance fallback when boxes
 * don't overlap at all (e.g. fast movement). Matched tracks inherit their
 * stable UUID; new detections get a fresh one. Tracks that remain unmatched
 * for more than MAX_AGE consecutive frames are evicted.
 *
 * This eliminates the flickering / wrong-label problem caused by index-based
 * IDs when MediaPipe changes detection order between frames.
 */

export interface Box {
  x: number // originX  (normalised 0–1 or raw pixels — units must be consistent)
  y: number // originY
  w: number // width
  h: number // height
}

interface Track {
  id: string   // stable UUID
  box: Box
  age: number  // frames since last matched
}

// ── tunables ──────────────────────────────────────────────────────────────────
/** Minimum IoU for two boxes to be considered the same face. */
const IOU_THRESHOLD = 0.15

/**
 * Maximum squared centroid distance (in the same units as the box coords)
 * used as a fallback when IoU is 0.  Expressed as a fraction of the diagonal
 * of the frame so it scales with resolution.  0.05 → within ~22% of the
 * frame diagonal.
 */
const CENTROID_DIST_FRACTION = 0.05

/** Frames a track can stay unmatched before being evicted. */
const MAX_AGE = 6
// ─────────────────────────────────────────────────────────────────────────────

function iou(a: Box, b: Box): number {
  const ax2 = a.x + a.w
  const ay2 = a.y + a.h
  const bx2 = b.x + b.w
  const by2 = b.y + b.h

  const ix1 = Math.max(a.x, b.x)
  const iy1 = Math.max(a.y, b.y)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)

  const interW = Math.max(0, ix2 - ix1)
  const interH = Math.max(0, iy2 - iy1)
  const inter = interW * interH

  if (inter === 0) return 0

  const areaA = a.w * a.h
  const areaB = b.w * b.h
  return inter / (areaA + areaB - inter)
}

function centroidDistSq(a: Box, b: Box): number {
  const dx = (a.x + a.w / 2) - (b.x + b.w / 2)
  const dy = (a.y + a.h / 2) - (b.y + b.h / 2)
  return dx * dx + dy * dy
}

export class FaceTracker {
  private tracks: Track[] = []

  /**
   * Call once per frame with the raw bounding boxes from MediaPipe.
   * Returns an array (same length, same order as `detections`) of stable IDs.
   */
  update(detections: Box[], frameDiagonalSq: number): string[] {
    const maxDistSq = frameDiagonalSq * CENTROID_DIST_FRACTION * CENTROID_DIST_FRACTION

    // Age all existing tracks; we'll reset age to 0 for matched ones below.
    for (const t of this.tracks) t.age++

    const matched = new Set<number>() // indices into this.tracks
    const stableIds: string[] = []

    for (const det of detections) {
      let bestTrackIdx = -1
      let bestScore = -Infinity

      for (let i = 0; i < this.tracks.length; i++) {
        if (matched.has(i)) continue

        const t = this.tracks[i]
        const iouScore = iou(det, t.box)

        let score: number
        if (iouScore >= IOU_THRESHOLD) {
          // Primary match: IoU.  Prefer higher IoU.
          score = iouScore
        } else {
          // Fallback: centroid distance when boxes don't overlap.
          // Convert to a [0, 1) score so it never beats a real IoU match.
          const distSq = centroidDistSq(det, t.box)
          if (distSq <= maxDistSq) {
            score = -distSq / maxDistSq // negative → always < any IoU score
          } else {
            continue // too far away, not a candidate
          }
        }

        if (score > bestScore) {
          bestScore = score
          bestTrackIdx = i
        }
      }

      if (bestTrackIdx !== -1) {
        // Matched an existing track — inherit its stable ID.
        const track = this.tracks[bestTrackIdx]
        track.box = det
        track.age = 0
        matched.add(bestTrackIdx)
        stableIds.push(track.id)
      } else {
        // No match — new face, create a new track.
        const newTrack: Track = {
          id: crypto.randomUUID(),
          box: det,
          age: 0
        }
        this.tracks.push(newTrack)
        matched.add(this.tracks.length - 1)
        stableIds.push(newTrack.id)
      }
    }

    // Evict tracks that have been unmatched too long.
    this.tracks = this.tracks.filter((t) => t.age <= MAX_AGE)

    return stableIds
  }

  /** Current set of live stable IDs (for pruning knownFacesRef). */
  get liveIds(): ReadonlySet<string> {
    return new Set(this.tracks.map((t) => t.id))
  }
}
