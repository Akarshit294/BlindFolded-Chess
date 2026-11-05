#!/usr/bin/env sh
# Starts the Playwright MCP browser server for Claude Code (see .mcp.json).
# Cloud sessions ship Chrome for Testing and set CHROME_PATH; Playwright's own
# browser download is usually blocked there, so use the preinstalled one.
if [ -n "$CHROME_PATH" ] && [ -x "$CHROME_PATH" ]; then
  exec npx -y @playwright/mcp@latest --headless --isolated --no-sandbox \
    --executable-path "$CHROME_PATH" --output-dir .playwright-mcp "$@"
fi
exec npx -y @playwright/mcp@latest --headless --isolated --output-dir .playwright-mcp "$@"
