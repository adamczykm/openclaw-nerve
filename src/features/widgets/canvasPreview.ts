import type { ChatMessage } from '@/types';
import { nativeCanvasHandles } from '../../../server/lib/canvas-handles';

export interface CanvasPreview {
  docId: string;
  title: string;
  preferredHeight?: number;
  sessionKey: string;
}

// Accept host-projected blocks and native show_widget result envelopes only.
export function extractCanvasPreviews(message: ChatMessage, sessionKey?: string): CanvasPreview[] {
  return sessionKey ? nativeCanvasHandles(message).map(handle => ({ ...handle, sessionKey })) : [];
}

export function validateWidgetPrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const hasControl = [...text].some(char => char.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(char));
  if (!text || text.length > 8000 || text.startsWith('/') || hasControl) return null;
  return text;
}
