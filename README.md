# Swimlanes Interactive Preview

A Visual Studio Code extension for creating and previewing sequence diagrams using the **[swimlanes.io](https://swimlanes.io)** syntax and renderer.

## Features

✨ **Syntax Highlighting** - Full support for `.swimlanes` files  
🔄 **Live Preview** - Real-time diagram rendering powered by [swimlanes.io](https://swimlanes.io)  
⚡ **Quick Start** - Create diagrams with sample templates  
🎨 **Rich Syntax** - Messages, conditionals, notes, icons, and more  

## Quick Start

1. **Create a diagram**: `Cmd+Shift+P` → "Swimlanes: Create Diagram"
2. **Preview**: Right-click `.swimlanes` file → "Open Swimlanes Preview"
3. **Edit and see live updates** as you type!

## Example

```swimlanes
title: Authentication Flow

User -> Server: Login request
Server -> Database: Validate credentials
Database -> Server: User data

if: Valid credentials
  Server -> User: Welcome!
else: Invalid credentials  
  Server -> User: Access denied
end

note: Simple authentication sequence
```

## Supported Syntax

- **Messages**: `Actor -> Another: Message`
- **Arrow Types**: `->`, `->>`, `-x`, `<->`, `<--`, `=>`
- **Conditionals**: `if:` / `else:` / `end`
- **Notes**: `note: Description`
- **Icons**: `{fas-star}`, `{fab-github}`
- **Formatting**: **bold**, *italic*, `code`

For complete syntax documentation, visit **[swimlanes.io](https://swimlanes.io/gallery/full-syntax)**.

## Commands

- `Swimlanes: Create Diagram` - Generate new diagram with template
- `Swimlanes: Preview Diagram` - Open live preview panel

## Settings

- `swimlanes.debug.dumpHtml` - Enable HTML debugging dumps
- `swimlanes.preview.autoRefresh` - Auto-refresh preview on file changes

## Requirements

- VS Code 1.102.0+
- Internet connection (loads [swimlanes.io](https://swimlanes.io) CDN)

---

**Learn more**: [swimlanes.io](https://swimlanes.io) | [Syntax Guide](https://swimlanes.io/gallery) | [Examples](https://swimlanes.io/examples)
