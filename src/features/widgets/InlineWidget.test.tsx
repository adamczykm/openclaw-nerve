import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ currentSession: 'agent:main:test', connectionState: 'connected', send: vi.fn() }));
vi.mock('@/contexts/ChatContext', () => ({ useChat: () => ({ handleSend: state.send, isGenerating: false }) }));
vi.mock('@/contexts/GatewayContext', () => ({ useGateway: () => ({ connectionState: state.connectionState }) }));
vi.mock('@/contexts/SessionContext', () => ({ useSessionContext: () => ({ currentSession: state.currentSession }) }));
import { InlineWidget } from './InlineWidget';

afterEach(cleanup);
beforeEach(() => { state.send.mockReset(); state.currentSession = 'agent:main:test'; state.connectionState = 'connected'; });

describe('widget interaction boundary', () => {
  it('isolates HTML and requires an application-owned confirmation before sending a proposed reply', async () => {
    render(<InlineWidget preview={{ docId: 'synthetic', title: 'Analiza', sessionKey: 'agent:main:test' }} />);
    const iframe = screen.getByTitle('Analiza') as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.src).not.toContain('token');
    const port = { onmessage: null as ((event: { data: unknown }) => void) | null, start: vi.fn(), postMessage: vi.fn(), close: vi.fn() };
    act(() => window.dispatchEvent(new MessageEvent('message', { source: iframe.contentWindow, origin: 'null', data: { type: 'openclaw:widget-prompt-offer' }, ports: [port as unknown as MessagePort] })));
    act(() => port.onmessage?.({ data: { type: 'openclaw:widget-prompt', prompt: 'Koszty netto, Q3 2026.' } }));
    expect(state.send).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Treść odpowiedzi z widżetu')).toHaveValue('Koszty netto, Q3 2026.');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Wyślij odpowiedź' })));
    expect(state.send).toHaveBeenCalledExactlyOnceWith('Koszty netto, Q3 2026.');
  });
  it('ignores messages from other frames and disconnects the sandbox on a session switch', () => {
    const { rerender } = render(<InlineWidget preview={{ docId: 'synthetic', title: 'Analiza', sessionKey: 'agent:main:test' }} />);
    act(() => window.dispatchEvent(new MessageEvent('message', { origin: 'null', data: { type: 'openclaw:widget-prompt', prompt: 'Untrusted' } })));
    expect(screen.queryByLabelText('Treść odpowiedzi z widżetu')).not.toBeInTheDocument();
    state.currentSession = 'agent:main:other';
    rerender(<InlineWidget preview={{ docId: 'synthetic', title: 'Analiza', sessionKey: 'agent:main:test' }} />);
    expect(screen.queryByTitle('Analiza')).not.toBeInTheDocument();
    expect(state.send).not.toHaveBeenCalled();
  });
});
