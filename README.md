# opencode-activity-timer

[![OpenCode](https://img.shields.io/badge/OpenCode-%E2%89%A51.3.14-blue)](https://opencode.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An [OpenCode](https://opencode.ai) **TUI plugin** that shows, right in the input
bar, **how long it has been since the last model output**. When you run several
opencode windows side by side, it lets you tell at a glance which one is stuck
and which one is still working.

## Features

- Live countdown of seconds since the last model output / activity
- Updates once per second, right next to other prompt-bar widgets (e.g. `opencode-tps`)
- Color-coded so a stuck window jumps out even from across the room:

| State | Display | Color |
| ----- | ------- | ----- |
| Generating | `> 3s` | Cyan (info) |
| Idle | `~ 12s` | Muted |
| Idle > 20s | `~ 30s` | Yellow (likely stuck) |
| Idle > 60s | `~ 90s` | Red (basically hung) |
| No output yet | `—` | Muted |

## Install

It is a local TUI plugin (source `"file"`), so you install it from a local
package path rather than from npm.

```bash
# clone or copy the repo, then:
opencode plugin -g /path/to/opencode-activity-timer
```

Or add it to your global `~/.config/opencode/tui.json` by hand:

```json
{
  "plugin": [
    "/path/to/opencode-activity-timer"
  ]
}
```

> Plugins are loaded when opencode **starts**. Restart your opencode windows
> after installing for it to take effect.

## How it works

It uses the same mechanism as `@williamcr01/opencode-tps` (a Solid.js
`TuiPlugin` registering the `session_prompt_right` slot). It keeps a per-session
"last activity" timestamp and refreshes it on:

- `message.part.delta` — the model is streaming text output
- `message.part.updated` — a tool started / completed / errored (so a window busy
  running a tool is not mistaken for being stuck)
- `session.status` — a new generation started (auto-resets the timer)

A 1s interval re-renders the label.

## Configuration

Tune the color-change thresholds at the top of `activity-timer.tsx`:

```ts
const WARN_S = 20   // longer than this -> yellow (possibly stuck)
const ALERT_S = 60  // longer than this -> red (almost certainly stuck)
```

## Requirements

- OpenCode >= 1.3.14
- OpenCode TUI (the Web UI does not load TUI plugins)

## License

MIT
