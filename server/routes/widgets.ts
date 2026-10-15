import { Hono } from 'hono';
import { gatewayRpcCall } from '../lib/gateway-rpc.js';
import { rateLimitGeneral } from '../middleware/rate-limit.js';
import { nativeCanvasHandles } from '../lib/canvas-handles.js';

const app = new Hono();

// The gateway remains the document store. Verify that this exact conversation's
// host-projected transcript contains the handle before retrieving its bytes.
app.get('/api/widgets/document', rateLimitGeneral, async (c) => {
  const docId = c.req.query('docId') || '';
  const sessionKey = c.req.query('sessionKey') || '';
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(docId) || !sessionKey || sessionKey.length > 512) {
    return c.json({ error: 'Invalid widget reference' }, 400);
  }
  try {
    const history = await gatewayRpcCall('chat.history', { sessionKey, limit: 500 }) as { messages?: Array<{ role?: string; content?: Array<{ type?: string; preview?: { viewId?: string; kind?: string; surface?: string; mcpApp?: unknown } }> }> };
    const present = history.messages?.some(message => nativeCanvasHandles(message).some(handle => handle.docId === docId));
    if (!present) return c.json({ error: 'Widget is not available in this conversation' }, 404);
    const view = await gatewayRpcCall('canvas.document.view', { docId }) as { html?: unknown };
    if (typeof view.html !== 'string' || Buffer.byteLength(view.html, 'utf8') > 10 * 1024 * 1024) {
      return c.json({ error: 'Widget document unavailable' }, 502);
    }
    c.header('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts");
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Content-Type-Options', 'nosniff');
    return c.html(view.html);
  } catch {
    return c.json({ error: 'Widget unavailable; reconnect or ask the assistant to recreate it' }, 502);
  }
});

export default app;
