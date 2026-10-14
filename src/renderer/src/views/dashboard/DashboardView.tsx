import { useState, useEffect, useCallback } from "react"
import { Button, Spinner, Table, Chip, Modal, useOverlayState } from "@heroui/react"
import { RefreshCw, Trash2, Trash, AlertCircle } from "lucide-react"
import type { Employee, AttendanceLog } from "@renderer/types"

const API = "http://127.0.0.1:8000"

// ── Reusable confirmation modal ───────────────────────────────────────────────
interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel: string
  isDanger?: boolean
}

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  isDanger = true
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog aria-label={title}>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {description}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant={isDanger ? "danger" : "primary"}
                size="sm"
                onPress={() => {
                  onConfirm()
                  onClose()
                }}
              >
                {confirmLabel}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

// ── DashboardView ─────────────────────────────────────────────────────────────
export function DashboardView() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Modal states
  const deleteState = useOverlayState()
  const clearLogsState = useOverlayState()
  const wipeAllState = useOverlayState()
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const deleteTarget = employees.find((e) => e._id === deleteTargetId)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [empRes, logRes] = await Promise.all([
        fetch(`${API}/employees`),
        fetch(`${API}/attendance`)
      ])
      if (!empRes.ok || !logRes.ok) throw new Error("Backend error")
      const empData = await empRes.json()
      const logData = await logRes.json()
      setEmployees(empData.employees)
      setLogs(logData.logs)
    } catch {
      setError("Could not reach backend. Is the Python server running?")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const deleteEmployee = async () => {
    if (!deleteTargetId) return
    await fetch(`${API}/employees/${deleteTargetId}`, { method: "DELETE" })
    setDeleteTargetId(null)
    fetchData()
  }

  const clearLogs = async () => {
    await fetch(`${API}/attendance`, { method: "DELETE" })
    fetchData()
  }

  const wipeAll = async () => {
    await Promise.all([
      fetch(`${API}/attendance`, { method: "DELETE" }),
      ...employees.map((emp) => fetch(`${API}/employees/${emp._id}`, { method: "DELETE" }))
    ])
    fetchData()
  }

  // ── Panel header style ──────────────────────────────────────────────────────
  const panelStyle = { background: "var(--surface)", border: "1px solid var(--border)" }
  const panelHeaderStyle = {
    background: "color-mix(in oklch, var(--background) 60%, transparent)",
    borderBottom: "1px solid var(--border)"
  }

  // ── Empty / loading state renderer ─────────────────────────────────────────
  const renderEmpty = (message: string) => () =>
    loading ? (
      <div className="flex justify-center py-10">
        <Spinner size="sm" color="accent" />
      </div>
    ) : (
      <p className="py-10 text-center text-sm" style={{ color: "var(--muted)" }}>
        {message}
      </p>
    )

  return (
    <div
      className="flex flex-col h-full w-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div
          className="shrink-0 mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "color-mix(in oklch, var(--danger) 10%, transparent)",
            border: "1px solid color-mix(in oklch, var(--danger) 25%, transparent)",
            color: "var(--danger)"
          }}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="ghost" size="sm" onPress={fetchData}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Two-panel layout ───────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden min-h-0">
        {/* ── Employees panel ─────────────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl overflow-hidden min-h-0" style={panelStyle}>
          {/* Header */}
          <div
            className="shrink-0 px-5 py-3.5 flex items-center justify-between gap-3"
            style={panelHeaderStyle}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <h2
                className="font-bold text-sm tracking-wide truncate"
                style={{ color: "var(--foreground)" }}
              >
                Registered Personnel
              </h2>
              <Chip color="default" variant="soft" size="sm">
                {employees.length}
              </Chip>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onPress={fetchData}
                isDisabled={loading}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--muted)" }}
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                Refresh
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={wipeAllState.open}
                className="flex items-center gap-1.5 text-xs"
              >
                <Trash size={12} />
                Wipe All
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-0 m-1">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Registered employees">
                  <Table.Header>
                    <Table.Column isRowHeader>Name</Table.Column>
                    <Table.Column>Role</Table.Column>
                    <Table.Column>Action</Table.Column>
                  </Table.Header>
                  <Table.Body
                    renderEmptyState={renderEmpty(
                      "No employees registered. Use the Register tab to add one."
                    )}
                  >
                    {employees.map((emp) => (
                      <Table.Row key={emp._id}>
                        <Table.Cell>
                          <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div
                            className="text-[11px] font-mono mt-0.5"
                            style={{ color: "var(--muted)" }}
                          >
                            {emp.email}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip color="success" variant="soft" size="sm">
                            {emp.role}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            onPress={() => {
                              setDeleteTargetId(emp._id)
                              deleteState.open()
                            }}
                            style={{ color: "var(--muted)" }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        </div>

        {/* ── Attendance Logs panel ─────────────────────────────────────────── */}
        <div className="flex flex-col rounded-2xl overflow-hidden min-h-0" style={panelStyle}>
          {/* Header */}
          <div
            className="shrink-0 px-5 py-3.5 flex items-center justify-between gap-3"
            style={panelHeaderStyle}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <h2 className="font-bold text-sm tracking-wide truncate text-foreground">
                Attendance Logs
              </h2>
              <Chip color="default" variant="soft" size="sm">
                {logs.length}
              </Chip>
            </div>
            <Button
              variant="danger"
              size="sm"
              onPress={clearLogsState.open}
              className="flex items-center gap-1.5 text-xs shrink-0"
            >
              <Trash size={12} />
              Clear Logs
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-0 m-1">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Attendance logs">
                  <Table.Header>
                    <Table.Column isRowHeader>Time</Table.Column>
                    <Table.Column>Employee</Table.Column>
                    <Table.Column>Event</Table.Column>
                  </Table.Header>
                  <Table.Body renderEmptyState={renderEmpty("No attendance logs yet.")}>
                    {logs.map((log) => (
                      <Table.Row key={log._id}>
                        <Table.Cell>
                          <span
                            className="text-xs font-mono whitespace-nowrap"
                            style={{ color: "var(--muted)" }}
                          >
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                            {log.first_name} {log.last_name}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>
                            {log.role}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip color="success" variant="soft" size="sm">
                            {log.event_type}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>
        </div>
      </div>

      {/* ── Confirmation modals ───────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={deleteState.isOpen}
        onClose={deleteState.close}
        onConfirm={deleteEmployee}
        title="Delete Employee"
        description={`Are you sure you want to delete ${deleteTarget ? `${deleteTarget.first_name} ${deleteTarget.last_name}` : "this employee"}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger
      />

      <ConfirmModal
        isOpen={clearLogsState.isOpen}
        onClose={clearLogsState.close}
        onConfirm={clearLogs}
        title="Clear Attendance Logs"
        description="Are you sure you want to clear all attendance logs? This action cannot be undone."
        confirmLabel="Clear Logs"
        isDanger
      />

      <ConfirmModal
        isOpen={wipeAllState.isOpen}
        onClose={wipeAllState.close}
        onConfirm={wipeAll}
        title="Wipe All Data"
        description="Are you sure you want to delete all employees and clear all attendance logs? This action cannot be undone."
        confirmLabel="Wipe All"
        isDanger
      />
    </div>
  )
}

export default DashboardView
