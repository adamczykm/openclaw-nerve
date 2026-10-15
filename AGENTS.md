# CEO Nerve extension

Keep this fork a small extension of upstream Nerve. Use the pinned `nix develop`
shell. Read `docs/CEO-INTEGRATION.md` before changing the widget or file bridge.

- OpenClaw owns inference, session authority and stored Canvas documents.
- Never execute agent HTML in the application origin. Widget prompts require
  an explicit confirmation outside the sandbox; widgets receive no credentials.
- Use synthetic fixtures and an isolated gateway for tests. Never send test
  messages to the real Telegram bot. Preserve the actual HOME; isolate state
  with OPENCLAW_CONFIG_PATH, MEMORY_PATH, SESSIONS_DIR and NERVE_DATA_DIR.
- Keep credentials, databases, transcripts and generated test output out of Git.
- Document changes, evidence and recovery in the companion ceo-assistant repo.
- Do not run the interactive upstream setup wizard against production without
  first reviewing its mutations. It can change gateway permissions and pairing.
