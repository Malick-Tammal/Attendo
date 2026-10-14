import { TrackedFace } from "../types"

export const cropFaceAsBase64 = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  face: TrackedFace
): string | null => {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const padX = face.box.w * 0.2
  const padY = face.box.h * 0.2

  const cropX = Math.max(0, face.box.x - padX)
  const cropY = Math.max(0, face.box.y - padY * 1.5)
  const cropW = Math.min(video.videoWidth - cropX, face.box.w + padX * 2)
  const cropH = Math.min(video.videoHeight - cropY, face.box.h + padY * 2.5)

  if (cropW < 10 || cropH < 10) return null

  canvas.width = cropW
  canvas.height = cropH

  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return canvas.toDataURL("image/jpeg", 0.6)
}
