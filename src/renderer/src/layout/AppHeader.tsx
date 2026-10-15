import { Chip } from "@heroui/react"
import type { DbStatus } from "@renderer/hooks/useDbHealth"

const STATUS_CONFIG: Record<
  DbStatus,
  { color: "success" | "danger" | "default"; label: string; ping: boolean }
> = {
  online: { color: "success", label: "System Online", ping: true },
  offline: { color: "danger", label: "System Offline", ping: false },
  checking: { color: "default", label: "Connecting…", ping: false }
}

function DbStatusChip({ status }: { status: DbStatus }) {
  const { color, label, ping } = STATUS_CONFIG[status]
  return (
    <Chip color={color} variant="soft" size="sm">
      <span className="flex items-center gap-1.5 px-1">
        <span className="relative flex h-1.5 w-1.5">
          {ping && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
        {label}
      </span>
    </Chip>
  )
}

interface AppHeaderProps {
  dbStatus: DbStatus
}

export function AppHeader({ dbStatus }: AppHeaderProps) {
  return (
    <nav className="shrink-0 z-10 w-full border-b border-separator bg-background/70 backdrop-blur-lg">
      <header className="flex h-12 items-center justify-between px-6">
        <h1 className="text-xl font-bold text-foreground">Face Detection</h1>
        <DbStatusChip status={dbStatus} />
      </header>
    </nav>
  )
}
