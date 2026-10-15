import { describe, expect, it } from 'vitest';
import { extractCanvasPreviews, validateWidgetPrompt } from './canvasPreview';
import { processChatMessages } from '@/features/chat/operations/loadHistory';
import type { ChatMessage } from '@/types';

const message: ChatMessage = { role: 'assistant', content: [
  { type: 'text', text: 'Dane syntetyczne' },
  { type: 'canvas', preview: { kind: 'canvas', surface: 'assistant_message', viewId: 'sample_123', title: 'Wynik', preferredHeight: 9000 } },
] };

describe('native Canvas descriptors', () => {
  it('restores Code Mode widgets while grouping native traces rather than displaying raw technical messages', () => {
    const details = { kind: 'canvas', presentation: { target: 'assistant_message', title: 'Synthetic' }, view: { id: 'nested_123' } };
    const trace: ChatMessage = { role: 'custom', customType: 'openclaw.nested-tool.v1', runId: 'run-1', content: [
      { type: 'toolCall', id: 'nested-1', name: 'show_widget', runId: 'run-1', parentToolCallId: 'exec-1', arguments: { title: 'Synthetic' } },
      { type: 'toolResult', role: 'toolResult', toolCallId: 'nested-1', toolName: 'show_widget', runId: 'run-1', parentToolCallId: 'exec-1', content: [{ type: 'text', text: JSON.stringify(details) }] },
    ] };
    const messages = processChatMessages([trace], { sessionKey: 'session' });
    expect(messages.flatMap(message => message.widgets ?? [])).toEqual([{ docId: 'nested_123', title: 'Synthetic', sessionKey: 'session' }]);
    expect(messages.every(message => message.role === 'tool' || message.role === 'assistant')).toBe(true);
    expect(messages.filter(message => message.role === 'assistant').every(message => message.rawText === '')).toBe(true);
    expect(processChatMessages([{ ...trace, customType: 'unknown' }], { sessionKey: 'session' })).toEqual([]);
    const reply: ChatMessage = { role: 'assistant', content: '[embed ref="nested_123" title="Synthetic" height="520" /]\n\nGotowe.' };
    expect(processChatMessages([trace, reply], { sessionKey: 'session' }).at(-1)?.rawText.trim()).toBe('Gotowe.');
    expect(processChatMessages([reply], { sessionKey: 'session' })[0].rawText).toContain('[embed');
    expect(processChatMessages([{ ...reply, role: 'user' }, trace], { sessionKey: 'session' })[0].rawText).toContain('[embed');
  });
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
