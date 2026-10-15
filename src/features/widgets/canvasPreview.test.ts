import { describe, expect, it } from 'vitest';
import { extractCanvasPreviews, validateWidgetPrompt } from './canvasPreview';
import { processChatMessages } from '@/features/chat/operations/loadHistory';
import type { ChatMessage } from '@/types';

const message: ChatMessage = { role: 'assistant', content: [
  { type: 'text', text: 'Dane syntetyczne' },
  { type: 'canvas', preview: { kind: 'canvas', surface: 'assistant_message', viewId: 'sample_123', title: 'Wynik', preferredHeight: 9000 } },
] };

describe('native Canvas descriptors', () => {
  it('retains widgets through the actual history pipeline with a bound session', () => {
    const messages = processChatMessages([message], { sessionKey: 'agent:main:test' });
    expect(messages[0].widgets).toEqual([{ docId: 'sample_123', title: 'Wynik', sessionKey: 'agent:main:test', preferredHeight: 1200 }]);
  });
  it('never treats user-provided descriptors or prose as widgets', () => {
    expect(extractCanvasPreviews({ ...message, role: 'user' }, 'session')).toEqual([]);
    expect(extractCanvasPreviews({ role: 'assistant', content: JSON.stringify(message.content) }, 'session')).toEqual([]);
    expect(extractCanvasPreviews(message)).toEqual([]);
  });
  it('restores the native compact dispatcher result rather than relying on live-only Canvas projection', () => {
    const result = { kind: 'canvas', presentation: { target: 'assistant_message', title: 'Wynik' }, view: { id: 'stored_123', url: '/__openclaw__/canvas/doc/stored_123/' } };
    const stored: ChatMessage = { role: 'toolResult', toolName: 'tool_call', content: [{ type: 'text', text: JSON.stringify({ tool: { id: 'openclaw:core:show_widget', name: 'show_widget', source: 'openclaw' }, result: { content: [{ type: 'text', text: JSON.stringify(result) }], details: result } }) }] };
    expect(processChatMessages([stored], { sessionKey: 'session' })[0].widgets).toEqual([{ docId: 'stored_123', title: 'Wynik', sessionKey: 'session' }]);
    expect(extractCanvasPreviews({ ...stored, role: 'user' }, 'session')).toEqual([]);
    expect(extractCanvasPreviews({ ...stored, toolName: 'read' }, 'session')).toEqual([]);
    expect(extractCanvasPreviews({ ...stored, isError: true }, 'session')).toEqual([]);
  });
  it('rejects traversal ids and unsupported app surfaces', () => {
    for (const preview of [{ viewId: '../config' }, { surface: 'node_panel' }, { mcpApp: { viewId: 'x' } }]) {
      expect(extractCanvasPreviews({ role: 'assistant', content: [{ type: 'canvas', preview: { kind: 'canvas', surface: 'assistant_message', viewId: 'good', ...preview } }] }, 'session')).toEqual([]);
    }
  });
  it('accepts bounded replies but refuses commands and control bytes', () => {
    expect(validateWidgetPrompt('  Koszty są netto.  ')).toBe('Koszty są netto.');
    for (const input of ['/approve', ' /stop', '\u0000bad', '', 'x'.repeat(8001), { text: 'x' }]) expect(validateWidgetPrompt(input)).toBeNull();
  });
});
