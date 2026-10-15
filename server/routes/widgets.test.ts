/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/gateway-rpc.js', () => ({ gatewayRpcCall: rpc }));
import widgets from './widgets.js';
import { securityHeaders } from '../middleware/security-headers.js';

const app = new Hono();
app.use('*', securityHeaders);
app.route('/', widgets);
const url = '/api/widgets/document?docId=proof_123&sessionKey=agent%3Amain%3Atest';
beforeEach(() => { rpc.mockReset(); });

describe('authenticated native widget document route', () => {
  it('checks session membership and keeps the restrictive document CSP through middleware', async () => {
    rpc.mockResolvedValueOnce({ messages: [{ role: 'assistant', content: [{ type: 'canvas', preview: { kind: 'canvas', surface: 'assistant_message', viewId: 'proof_123' } }] }] })
      .mockResolvedValueOnce({ html: '<h1>Synthetic</h1><script>document.body.dataset.ok="yes"</script>' });
    const response = await app.request(url);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<h1>Synthetic</h1>');
    expect(response.headers.get('Content-Security-Policy')).toContain('sandbox allow-scripts');
    expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'none'");
    expect(response.headers.get('Content-Security-Policy')).not.toContain('allow-same-origin');
    expect(rpc.mock.calls).toEqual([['chat.history', { sessionKey: 'agent:main:test', limit: 500 }], ['canvas.document.view', { docId: 'proof_123' }]]);
  });
  it('does not retrieve a document absent from that session or present only in user content', async () => {
    rpc.mockResolvedValue({ messages: [{ role: 'user', content: [{ type: 'canvas', preview: { kind: 'canvas', surface: 'assistant_message', viewId: 'proof_123' } }] }] });
    expect((await app.request(url)).status).toBe(404);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects paths and external URLs without a gateway call', async () => {
    expect((await app.request('/api/widgets/document?docId=..%2Fsecret&sessionKey=test')).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns a bounded error without leaking gateway exceptions', async () => {
    rpc.mockRejectedValue(new Error('sensitive upstream failure'));
    const response = await app.request(url);
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('sensitive');
  });
});
