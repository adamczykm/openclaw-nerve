# CEO integration (development)

Upstream: daggerhashimoto/openclaw-nerve, branch master, version 1.5.4.
This fork adds support for OpenClaw 2026.10.3 native inline HTML widgets and
an optional connection to the existing CEO document archive. The companion
meta-wiki records the deployed revision and its verification.

## Ownership

OpenClaw owns inference, Canvas documents and session history. Nerve declares
`inline-widgets`, consumes host-projected `canvas` content blocks and exact
native `show_widget` tool results retained in compact `tool_call` envelopes
or host-authored Code Mode `openclaw.nested-tool.v1` records with matching
call/result identity, tool name, run and parent call,
and retrieves
documents with `canvas.document.view` only after checking that the exact
conversation's retained history contains that document. Never reconstruct a
widget from arbitrary HTML prose or an external URL. MCP Apps, pinned dashboard
grants and arbitrary widget RPCs are not part of this first implementation.

The frame and response are sandboxed without `allow-same-origin`, forms, popups
or top-level navigation. Response CSP restricts scripts to inline code and
disables network connections, external assets, nested frames and workers. This
first version requires self-contained widgets; it does not load CDN libraries.
The app adopts the canonical wrapper's first prompt MessagePort. A message from
that port can only propose bounded text. A separate application-owned editable
confirmation must be clicked to send it to the currently matching conversation.
Commands, stale sessions and disconnected clients are rejected. No gateway
token, browser storage or plugin tool access is exposed to the widget.

The server repeats native session read authorization on document retrieval.
This is an operator-only interface, not a public dashboard or employee portal.
Native history lookup is bounded to 500 entries: older widgets may need recreation.
Widget forms are transient until an answer is sent and persisted by the agent.

## Files

Set NERVE_CEO_COMMAND to the absolute deployed `ceo` executable and
NERVE_CEO_STATE_DIR to the existing catalog root. Both are runtime settings,
not request parameters. CSV, XLSX, text PDF, TXT and Markdown uploads are
archived with a real source receipt before the UI reports success. The browser
selects production or demo explicitly; production is default. Removing an
attachment from the composer does not delete its already archived original.
The agent processes pending files and clarifies metadata with existing tools.
An archive receipt means preserved original, not validated financial content.

Enable NERVE_UPLOAD_FILE_REFERENCE_ENABLED=true so the picker accepts documents.
Use NERVE_UPLOAD_STAGING_TEMP_DIR inside workspace/inbox/nerve and preserve that
root in the CEO plugin's inboundRoots. No language model/API keys need to be
copied to Nerve. Configure the existing agent, memory and model in OpenClaw.

## Development and deployment

Use `nix develop -c npm ci --ignore-scripts`, then
`nix develop -c npm run build` and targeted `npm test -- --run` checks.
Native optional voice/terminal dependencies may need separate builds before
those features are used. The pinned devShell owns development dependencies.

Do not run upstream `npm run setup -- --defaults` against production: it can
rewrite pairing/configuration and restart the gateway. Review needed changes
explicitly. Keep inference configuration and real credentials on the VPS.

Deploy Nerve beside OpenClaw, with the same workspace, loopback gateway,
NERVE_AUTH=true, a separate password hash and HTTPS remote access. Store runtime
secrets in a mode-0600 file outside Git. Include NERVE_DATA_DIR, configuration
and chosen upstream/fork revisions in encrypted recovery. The companion
ceo-assistant meta-wiki owns the deployment and test evidence.

The companion deploy pins rootless Tailscale 1.104.1 and binds Nerve to
127.0.0.1:3080. Only private Serve is intended; node enrollment remains a human
action. The initial access policy is two operators (administrator and owner),
both with full access to one shared CEO workspace. Nerve currently has a shared
operator password, not per-person application roles or action attribution.
