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
