# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-03-31

### Added
- `scripting` permission to re-inject content scripts into existing tabs after extension reload/update.

### Changed
- Daily tracking now resets on first visit of the day instead of at midnight, avoiding issues with sleep/idle carrying stale time into the new day.
- Removed midnight alarm; the `alarms` permission is still used for the periodic time-sync.

### Fixed
- Block screen ("Time's Up") no longer persists after the daily timer resets. Blocked tabs now re-sync with the background on focus/visibility change.
- Overnight idle time no longer gets incorrectly charged to the new day's tracking.
- Content scripts now properly re-initialize after extension reload/update.

## [1.0.0] - 2026-03-28

### Added
- Initial project structure focusing on a privacy-first Chrome extension.
- Core extension components: background scripts, content scripts, and options/popup UI.
- `PRIVACY.md` detailing the local-only data approach.
- GitHub Pages configuration for documentation and privacy policy (`_config.yml`).
