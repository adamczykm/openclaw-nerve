import { useEffect, useRef, useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useGateway } from '@/contexts/GatewayContext';
import { useSessionContext } from '@/contexts/SessionContext';
import { validateWidgetPrompt, type CanvasPreview } from './canvasPreview';

/** OpenClaw supplies the wrapped document and its private MessagePort bridge.
 * Nerve supplies the opaque frame and a separate, human-confirmed send action.
 * No board grants, gateway tokens or arbitrary RPCs enter the widget. */
export function InlineWidget({ preview }: { preview: CanvasPreview }) {
  const { handleSend, isGenerating } = useChat();
  const { currentSession } = useSessionContext();
  const { connectionState } = useGateway();
  const frame = useRef<HTMLIFrameElement>(null);
  const port = useRef<MessagePort | null>(null);
  const alive = useRef(true);
  const [height, setHeight] = useState(preview.preferredHeight || 420);
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const active = currentSession === preview.sessionKey && connectionState === 'connected';

  useEffect(() => {
    alive.current = true;
    setPending(null);
    setError('');
    if (!active) return;
    let disposed = false;
    let promptCount = 0;
    const started = Date.now();
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      if (event.data?.type === 'openclaw:widget-size' && Number.isFinite(event.data.height)) {
        setHeight(Math.min(1600, Math.max(200, Math.ceil(event.data.height))));
      }
      if (event.data?.type === 'openclaw:widget-runtime-error') {
        setError('Widżet zgłosił błąd. Poproś asystenta o poprawienie analizy.');
      }
      if (event.data?.type !== 'openclaw:widget-prompt-offer' || port.current || !event.ports[0]) return;
      const offered = event.ports[0];
      port.current = offered;
      offered.onmessage = (message) => {
        if (disposed || message.data?.type !== 'openclaw:widget-prompt') return;
        const prompt = validateWidgetPrompt(message.data.prompt);
        if (!prompt || ++promptCount > 10 || Date.now() - started > 24 * 60 * 60 * 1000) return;
        // A widget can only propose text. The application-owned button sends it.
        setPending(prompt);
      };
      offered.start();
      offered.postMessage({ type: 'openclaw:widget-prompt-host-ready' });
    };
    window.addEventListener('message', listener);
    return () => {
      disposed = true;
      alive.current = false;
      window.removeEventListener('message', listener);
      port.current?.close();
      port.current = null;
    };
  }, [active, preview.docId, preview.sessionKey, attempt]);

  const send = async () => {
    if (!active || !pending || sending || isGenerating) return;
    setSending(true);
    try {
      await handleSend(pending);
      if (alive.current) setPending(null);
    } finally {
      if (alive.current) setSending(false);
    }
  };
  const source = '/api/widgets/document?' + new URLSearchParams({ docId: preview.docId, sessionKey: preview.sessionKey, attempt: String(attempt) });

  return <section aria-label={'Widżet: ' + preview.title} className="my-3 w-full max-w-[1120px] overflow-hidden rounded-xl border border-border bg-card">
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
      <span className="font-medium">{preview.title}</span>
      <button type="button" className="cockpit-toolbar-button" onClick={() => setAttempt(value => value + 1)}>Odśwież widżet</button>
    </div>
    {active ? <iframe key={attempt} ref={frame} title={preview.title} src={source}
      sandbox="allow-scripts" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
      className="w-full border-0 bg-white" style={{ height }} />
      : <p className="p-3 text-muted-foreground">Połącz się z rozmową, aby wyświetlić widżet.</p>}
    {error && <p role="alert" className="p-3 text-warning">{error}</p>}
    {pending && <div className="border-t border-border p-3">
      <p className="mb-2 text-sm font-medium">Odpowiedź do asystenta</p>
      <textarea aria-label="Treść odpowiedzi z widżetu" value={pending} maxLength={8000}
        onChange={event => setPending(event.target.value)} className="min-h-20 w-full rounded border border-border bg-background p-2" />
      <div className="mt-2 flex gap-2">
        <button type="button" className="cockpit-toolbar-button" disabled={!active || isGenerating || sending || !validateWidgetPrompt(pending)} onClick={() => void send()}>Wyślij odpowiedź</button>
        <button type="button" className="cockpit-toolbar-button" onClick={() => setPending(null)}>Anuluj</button>
      </div>
    </div>}
  </section>;
}
