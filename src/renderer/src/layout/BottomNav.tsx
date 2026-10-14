import { Tabs } from "@heroui/react"
import { Video, LayoutDashboard, UserPlus } from "lucide-react"

interface BottomNavProps {
  tab: string
  setTab: (tab: string) => void
}

export function BottomNav({ tab, setTab }: BottomNavProps) {
  return (
    <nav className="shrink-0 flex items-center justify-center py-3">
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Navigation">
            <Tabs.Tab id="camera">
              <Video size={16} className="mr-1.5" fill="currentColor" />
              Camera
              <Tabs.Indicator className="bg-accent" />
            </Tabs.Tab>
            <Tabs.Tab id="dashboard">
              <LayoutDashboard size={16} className="mr-1.5" fill="currentColor" />
              Dashboard
              <Tabs.Indicator className="bg-accent" />
            </Tabs.Tab>
            <Tabs.Tab id="add_employee">
              <UserPlus size={16} className="mr-1.5" fill="currentColor" />
              Register
              <Tabs.Indicator className="bg-accent" />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
    </nav>
  )
}
