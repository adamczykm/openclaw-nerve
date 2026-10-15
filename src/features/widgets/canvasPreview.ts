import type { ChatMessage } from '@/types';

export interface CanvasPreview {
  docId: string;
  title: string;
  preferredHeight?: number;
  sessionKey: string;
}

// Only accept host-projected Canvas blocks, never HTML or URLs in user prose.
export function extractCanvasPreviews(message: ChatMessage, sessionKey?: string): CanvasPreview[] {
  if (message.role !== 'assistant' || !sessionKey || !Array.isArray(message.content)) return [];
  const found = new Map<string, CanvasPreview>();
  for (const block of message.content) {
    if (block.type !== 'canvas') continue;
    const preview = block.preview;
    if (!preview || preview.kind !== 'canvas' || preview.surface !== 'assistant_message') continue;
    if (preview.mcpApp || typeof preview.viewId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(preview.viewId)) continue;
    found.set(preview.viewId, {
      docId: preview.viewId,
      title: typeof preview.title === 'string' ? preview.title.slice(0, 160) : 'Analiza',
      sessionKey,
      preferredHeight: typeof preview.preferredHeight === 'number' && Number.isFinite(preview.preferredHeight)
        ? Math.min(1200, Math.max(200, preview.preferredHeight)) : undefined,
    });
  }
  return [...found.values()];
}

export function validateWidgetPrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > 8000 || text.startsWith('/') || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return null;
  return text;
}
