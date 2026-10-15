import { describe, expect, it } from 'vitest';
import { nativeCanvasHandles, nativeNestedToolPair } from './canvas-handles';

function trace() {
  const details = { kind: 'canvas', presentation: { target: 'assistant_message', title: 'Synthetic' }, view: { id: 'proof_123' } };
  return {
    role: 'custom', customType: 'openclaw.nested-tool.v1', runId: 'run-1',
    content: [
      { type: 'toolCall', id: 'nested-1', name: 'show_widget', runId: 'run-1', parentToolCallId: 'exec-1' },
      { type: 'toolResult', role: 'toolResult', toolCallId: 'nested-1', toolName: 'show_widget', runId: 'run-1', parentToolCallId: 'exec-1', content: [{ type: 'text', text: JSON.stringify(details) }] },
    ],
  };
}

describe('native Code Mode Canvas provenance', () => {
  it('restores the host nested result independently of exec output and final prose', () => {
    expect(nativeCanvasHandles(trace())).toEqual([{ docId: 'proof_123', title: 'Synthetic' }]);
    expect(nativeNestedToolPair(trace())?.call.name).toBe('show_widget');
  });
  it('rejects role spoofing, non-native custom records and mismatched host identities', () => {
    for (const change of [{ role: 'user' }, { role: 'assistant' }, { customType: 'document' }, { runId: 'other' }]) {
      expect(nativeCanvasHandles({ ...trace(), ...change })).toEqual([]);
    }
    for (const change of [{ toolCallId: 'other' }, { toolName: 'read' }, { runId: 'other' }, { parentToolCallId: 'other' }, { role: 'user' }]) {
      const message = trace();
      Object.assign(message.content[1], change);
      expect(nativeCanvasHandles(message)).toEqual([]);
      expect(nativeNestedToolPair(message)).toBeUndefined();
    }
  });
  it('does not trust arbitrary exec output, copied trace JSON or failed native results', () => {
    const message = trace();
    Object.assign(message.content[1], { isError: true });
    expect(nativeCanvasHandles(message)).toEqual([]);
    for (const role of ['user', 'assistant', 'toolResult']) {
      expect(nativeCanvasHandles({ role, toolName: 'exec', content: JSON.stringify(trace()) })).toEqual([]);
    }
    expect(nativeCanvasHandles({ role: 'assistant', content: '[embed ref="proof_123" /]' })).toEqual([]);
  });
});
