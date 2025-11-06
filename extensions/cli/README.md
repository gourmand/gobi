# Gobi CLI

The Gobi CLI (`gobi`, shortcut `gi`) is a customizable command line coding agent.

![Gobi CLI Demo](./media/demo.gif)

## Installation

```bash
npm i -g @gourmanddev/cli
```

## Usage

```bash
gobi
```

### Headless Mode

```bash
gobi -p "Generate a conventional commit name for the current git changes."
```

### Session Management

The CLI automatically saves your chat history for each terminal session. You can resume where you left off:

```bash
# Resume the last session in this terminal
gobi --resume

# List recent sessions and choose one to resume
gobi ls

# List sessions in JSON format (for scripting)
gobi ls --json
```

## Command Line Options

- `-p`: Run in headless mode (no TUI)
- `--config <path>`: Specify agent configuration path
- `--resume`: Resume the last session for this terminal
- `<prompt>`: Optional prompt to start with

## Commands

- `gobi`: Start an interactive chat session (alias: `gi`)
- `gobi ls`: List recent sessions with TUI selector to choose one to resume
- `gobi login`: Authenticate with Gobi
- `gobi logout`: Sign out of current session
- `gobi remote`: Launch a remote instance
- `gobi serve`: Start HTTP server mode

### Session Listing (`gobi ls`)

Shows recent sessions, limited by screen height to ensure it fits on your terminal.

- `--json`: Output in JSON format for scripting (always shows 10 sessions)
