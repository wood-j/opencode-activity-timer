/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal } from "solid-js"
import type { TuiPlugin } from "@opencode-ai/plugin/tui"

// Displays how long it's been since the last model output / activity.
// Rendered in the prompt bar (session_prompt_right slot), so with several
// opencode windows open you can tell at a glance which one is stuck.
// Same mechanism as @williamcr01/opencode-tps.

const WARN_S = 20   // longer than this -> yellow (possibly stuck)
const ALERT_S = 60  // longer than this -> red (almost certainly stuck)

interface DeltaEvent {
  type: "message.part.delta"
  properties: { sessionID: string; field: string }
}
interface PartUpdatedEvent {
  type: "message.part.updated"
  properties: { part: { sessionID: string; type: string; state?: { status: string } } }
}
interface StatusEvent {
  type: "session.status"
  properties: { sessionID: string; status: { type: string } }
}

const tui: TuiPlugin = async (api) => {
  // sessionID -> timestamp of the most recent "something happened"
  const lastActivity = new Map<string, number>()
  const [version, setVersion] = createSignal(0)
  const [tick, setTick] = createSignal(0)

  function mark(sessionID: string) {
    lastActivity.set(sessionID, Date.now())
    setVersion((v) => v + 1)
  }

  // Streaming text delta -> the model is producing output, reset the timer
  const unsubDelta = api.event.on(
    "message.part.delta" as unknown as "message.part.delta",
    (evt: DeltaEvent) => {
      const p = evt.properties
      if (!p?.sessionID || p.field !== "text") return
      if (api.state.session.status(p.sessionID)?.type === "idle") return
      mark(p.sessionID)
    },
  )

  // Tool execution also counts as "activity" (running/completed/error),
  // so we don't flag a window as stuck while it's just busy running a tool.
  const unsubPart = api.event.on("message.part.updated", (evt: PartUpdatedEvent) => {
    const part = evt.properties?.part
    if (part?.type !== "tool" || !part.sessionID) return
    const status = part.state?.status
    if (status === "running" || status === "completed" || status === "error") {
      mark(part.sessionID)
    }
  })

  // A new generation started (status became non-idle) -> reset the timer
  const unsubStatus = api.event.on("session.status", (evt: StatusEvent) => {
    const p = evt.properties
    if (!p?.sessionID) return
    if (p.status?.type !== "idle") mark(p.sessionID)
  })

  const interval = setInterval(() => setTick((t) => t + 1), 1000)

  api.lifecycle.onDispose(() => {
    unsubDelta()
    unsubPart()
    unsubStatus()
    clearInterval(interval)
  })

  api.slots.register({
    slots: {
      session_prompt_right(ctx, props) {
        const sessionID = props.session_id
        const textMuted = ctx.theme.current.textMuted
        const info = ctx.theme.current.info
        const warning = ctx.theme.current.warning
        const error = ctx.theme.current.error

        const view = createMemo(() => {
          version()
          tick()
          const status = api.state.session.status(sessionID)
          const active = !!status && status.type !== "idle"
          const last = lastActivity.get(sessionID)
          let s = -1
          if (last) s = Math.max(0, Math.round((Date.now() - last) / 1000))
          return { active, s }
        })

        const v = view()
        let color = textMuted
        let label: string

        if (v.active) {
          // Currently generating: show throughput duration (deltas keep
          // resetting it, so it hovers near 0)
          color = info
          label = `> ${v.s}s`
        } else if (v.s < 0) {
          label = "—"
        } else {
          // Idle: show seconds since the last output
          label = `~ ${v.s}s`
          if (v.s > ALERT_S) color = error
          else if (v.s > WARN_S) color = warning
        }

        return <text fg={color}>{label}</text>
      },
    },
  })
}

export default {
  id: "opencode-activity-timer",
  tui,
}
