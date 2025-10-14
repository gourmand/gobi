# Gobi anonymous Posthog telemetry

## Behavior

- Used by Gobi for product metrics (not used by customers)
- uses public posthog key in repo
- GOBI_ALLOW_ANONYMOUS_TELEMETRY can be set to 0 to disable
- non-anonymous and private data like code is never sent to posthog
- Event user ids are the Gobi user id is signed in, or a unique machine id if not
- Current events are slash command usage and chat calls
