# PRison 🔒

> Your PRs are in prison. Only YOU can set them free.

PRison is a VS Code extension that watches your GitHub PRs and shames you into action with **Dark Souls-style full-screen overlays** when you try to start new work while your PR queue is rotting.

## Features

- 🎮 **Dark Souls overlay** — Full-screen "YOU DIED" style shame screen with Gen Z meme messages when you checkout a new branch with open PR debt
- 📊 **Status bar counter** — Persistent `🔥 PRison: 3 open · 2 reviews` shame counter always visible
- 🌳 **PR Shame Board** — Sidebar tree showing all your open PRs and review requests with age, unresolved threads, and review state
- 🔔 **Startup notification** — Memes on VS Code startup reminding you what you've ignored
- 🥀 **Falling petals** — Because your PRs are dying

## Meme Messages

> "Hot open PRs in your area 🔥"

> "Skill issue detected in PR #142 🤡"

> "This PR is cooked 💀"

> "POV: You tried to code with open comments 😭"

> "AI Slop detected. Resolve comments before generating more tech debt 🤖"

> "Not you starting a new feature with 3 reviews pending fr fr 💀"

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
| `prison.repos` | `[]` | GitHub repos to monitor (auto-detects from git remote if empty) |
| `prison.pollingInterval` | `5` | Minutes between PR checks |
| `prison.shameThreshold` | `"mild"` | Minimum shame level to trigger overlay (`mild`, `moderate`, `severe`) |
| `prison.enabled` | `true` | Master toggle |
| `prison.overlayOnStartup` | `true` | Show overlay on VS Code start |
| `prison.overlayOnBranchChange` | `true` | Show overlay on branch checkout/creation |

## Commands

- `PRison: Show Shame Overlay` — Manually trigger the overlay
- `PRison: Check PRs Now` — Force a PR status refresh
- `PRison: Clear Cache` — Clear cached GitHub data

## Requirements

- VS Code 1.85.0+
- GitHub account (VS Code's built-in GitHub auth)

## License

MIT
