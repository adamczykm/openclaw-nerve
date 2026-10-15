/** Pure protocol adapter shared by the browser and server. No filesystem,
 * credentials or Node imports: OpenClaw can persist compact tool-dispatcher
 * envelopes while its live stream supplies projected Canvas blocks. */
export interface NativeCanvasHandle { docId: string; title: string; preferredHeight?: number }
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;

function projected(value: unknown): NativeCanvasHandle | undefined {
  const p = record(value);
  if (!p || p.kind !== 'canvas' || p.surface !== 'assistant_message' || p.mcpApp) return;
  if (typeof p.viewId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(p.viewId)) return;
  return { docId: p.viewId, title: typeof p.title === 'string' ? p.title.slice(0, 160) : 'Analiza',
    ...(typeof p.preferredHeight === 'number' && Number.isFinite(p.preferredHeight) ? { preferredHeight: Math.min(1200, Math.max(200, p.preferredHeight)) } : {}) };
}

function decode(value: unknown): unknown {
  if (typeof value !== 'string' || value.length > 65536) return value;
  try { return JSON.parse(value); } catch { return undefined; }
}

/** Code Mode persists nested calls as host-authored custom records, separately
 * from exec's arbitrary JSON output. Accept only a matched call/result pair. */
export function nativeNestedToolPair(value: unknown): { call: RecordValue; result: RecordValue } | undefined {
  const message = record(value);
  if (message?.role !== 'custom' || message.customType !== 'openclaw.nested-tool.v1' || !Array.isArray(message.content)) return;
  if (message.content.length !== 2 || typeof message.runId !== 'string' || !message.runId) return;
  const call = record(message.content[0]);
  const result = record(message.content[1]);
  if (call?.type !== 'toolCall' || result?.type !== 'toolResult' || result.role !== 'toolResult') return;
  if (typeof call.id !== 'string' || !call.id || result.toolCallId !== call.id) return;
  if (typeof call.name !== 'string' || !call.name || result.toolName !== call.name) return;
  if (call.runId !== message.runId || result.runId !== message.runId) return;
  if (typeof call.parentToolCallId !== 'string' || !call.parentToolCallId || result.parentToolCallId !== call.parentToolCallId) return;
  return { call, result };
}

export function nativeCanvasHandles(value: unknown): NativeCanvasHandle[] {
  const message = record(value);
  if (!message || message.isError === true) return [];
  const nested = nativeNestedToolPair(message);
  if (nested) return nativeCanvasHandles(nested.result);
  const found = new Map<string, NativeCanvasHandle>();
  if (message.role === 'assistant' && Array.isArray(message.content)) {
    for (const block of message.content) {
      const b = record(block);
      const handle = b?.type === 'canvas' ? projected(b.preview) : undefined;
      if (handle) found.set(handle.docId, handle);
    }
  }
  // Never infer a tool result from assistant/user prose, nor from an unrelated
  // tool that merely printed widget-shaped JSON from a document.
  if (!['toolResult', 'tool'].includes(String(message.role))) return [...found.values()];
  const name = message.toolName ?? message.tool_name ?? message.name;
  if (name !== 'show_widget' && name !== 'tool_call') return [];
  const content = message.content;
  const text = Array.isArray(content) ? content.map(item => record(item)?.type === 'text' ? record(item)?.text : '').join('\n') : content;
  let result = decode(text);
  if (name === 'tool_call') {
    const envelope = record(result);
    if (!envelope) return [];
    const tool = record(envelope?.tool);
    if (envelope?.tool !== 'show_widget' && !(tool?.id === 'openclaw:core:show_widget' && tool.name === 'show_widget' && tool.source === 'openclaw')) return [];
    result = envelope.result;
  }
  for (let depth = 0; depth < 4; depth++) {
    result = decode(result);
    const data = record(result);
    if (!data) break;
    if (data.isError === true) break;
    if (data.kind === 'canvas') {
      const presentation = record(data.presentation);
      const view = record(data.view);
      const handle = projected({ kind: 'canvas', surface: presentation?.target ?? 'assistant_message', viewId: view?.id,
        title: presentation?.title, preferredHeight: presentation?.preferred_height });
      if (handle) found.set(handle.docId, handle);
      break;
    }
    if (record(data.details)) { result = data.details; continue; }
    if (Array.isArray(data.content)) { result = data.content.map(item => record(item)?.type === 'text' ? record(item)?.text : '').join('\n'); continue; }
    break;
  }
  return [...found.values()];
}
