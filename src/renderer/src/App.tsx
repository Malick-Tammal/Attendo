import { useState } from "react"
import { AppHeader } from "./layout/AppHeader"
import { BottomNav } from "./layout/BottomNav"
import { CameraView } from "./views/camera/CameraView"
import { DashboardView } from "./views/dashboard/DashboardView"
import { RegisterView } from "./views/register/RegisterView"
import { useDbHealth } from "./hooks/useDbHealth"

export function App() {
  const [tab, setTab] = useState("camera")
  const dbStatus = useDbHealth()

  return (
    <div className="h-screen w-screen flex flex-col font-sans overflow-hidden bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <AppHeader dbStatus={dbStatus} />

      {/* ── Main content view ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {tab === "camera" && <CameraView />}
        {tab === "dashboard" && <DashboardView />}
        {tab === "add_employee" && <RegisterView setTab={setTab} />}
      </main>

      {/* ── Bottom navigation ──────────────────────────────────────────────── */}
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  )
}

export default App
