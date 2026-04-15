# Changelog

## [1.0.2] - 2026-04-15

### Changed
- Updated changelog to reflect actual release history

## [1.0.1] - 2026-04-15

### Fixed
- Repository URL in package.json pointing to wrong GitHub repo

## [1.0.0] - 2026-04-15

### Added
- Full-screen shame overlay with meme messages when PRs need attention
- Shame triggers at 1+ PRs needing attention (own PRs with issues + pending reviews)
- Branch checkout and terminal open detection triggers overlay
- Status bar counter showing total PRs needing attention
- PR sidebar with three collapsible sections: Your Open PRs, Not Reviewed by You, Reviewed / Approved
- Startup meme notification on VS Code launch
- Falling 🥀 petal animation + meme sound effects on overlay
- VS Code built-in GitHub authentication (no manual token setup)
- Multi-repo support with auto-detection from git remote
- Configurable polling interval, required approvals, and overlay triggers
