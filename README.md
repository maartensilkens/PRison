# PRison 🔒

> Your PRs are in prison. Only YOU can set them free.

PRison is a VS Code extension that watches your GitHub PRs and shames you into action with full-screen overlays when you try to start new work while your PR queue is rotting.

## Features

- 🚨 **Shame overlay** — Full-screen shame screen with meme messages. Triggers on startup, branch checkout, and terminal open when you have actionable PRs
- 📊 **Status bar counter** — Always-visible indicator showing your open PR debt (neutral → orange → red)
- 🗂️ **PR Sidebar** — Full overview of all PRs across three collapsible sections: your open PRs, PRs waiting for your review, and PRs you've already reviewed
- 🔔 **Startup notification** — Reminds you what you've ignored before you've even written a line
- 🔊 **Meme sounds** — Audible shame when the overlay appears
- 🥀 **Falling petals** — Because your PRs are dying

## What counts as "needs attention"?

PRison only counts PRs that are **actually actionable**:

- ✅ Your own open PRs with unresolved comments or changes requested by a reviewer
- ✅ PRs from teammates ready for your review (no unresolved comments blocking)
- ❌ PRs waiting on you that have open unresolved comments — those are the author's problem

**Status bar:**
- Neutral — nothing to do
- 🟠 Orange — 1 PR needs attention (overlay fires)
- 🔴 Red — 2+ PRs need attention

## Meme Messages

> "Hot open PRs in your area 🔥"

> "Skill issue detected in PR #142 🤡"

> "This PR is cooked 💀"

> "POV: You tried to code with open comments 😭"

> "AI Slop detected. Resolve comments before generating more tech debt 🤖"

> "Erm... what the sigma? Review your PRs first 🐺"

...and 20+ more.

## Setup

1. Install the extension
2. Open a GitHub-connected workspace
3. PRison will prompt for GitHub authentication on first launch (uses VS Code's built-in GitHub auth — no token setup needed)
4. That's it. Shame will follow.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `prison.repos` | `[]` | GitHub repos to monitor. Leave empty to auto-detect from git remote |
| `prison.pollingInterval` | `5` | Minutes between PR checks |
| `prison.requiredApprovals` | `2` | Approvals needed before a PR is considered done |
| `prison.overlayOnStartup` | `true` | Show shame overlay when VS Code starts |
| `prison.overlayOnBranchChange` | `true` | Show shame overlay on branch checkout/creation |
| `prison.blockTerminal` | `true` | Show shame overlay when opening a terminal while you have PRs needing attention |
| `prison.soundEnabled` | `true` | Play a meme sound when the overlay appears |
| `prison.enabled` | `true` | Master kill switch — disables overlays and terminal blocking (sidebar still works) |

## Commands

- `PRison: Show Shame Overlay` — Manually trigger the overlay
- `PRison: Check PRs Now` — Force a PR status refresh
- `PRison: Clear Cache` — Clear cached GitHub data
- `PRison: Demo` — Preview the overlay with mock data

## Requirements

- VS Code 1.85.0+
- GitHub account (VS Code's built-in GitHub auth)

## License

MIT
