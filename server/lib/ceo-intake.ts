import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
export type CEODataNamespace = 'production' | 'demo';
export interface CEOArchiveReceipt { id: string; namespace: CEODataNamespace; status: string }

export function ceoIntakeEnabled(): boolean {
  return Boolean(process.env.NERVE_CEO_COMMAND && process.env.NERVE_CEO_STATE_DIR);
}

/** Owner-only Nerve uses the same local catalog as the OpenClaw plugin. Intake
 * archives originals before any model turn. It cannot invoke models or messages.
 * Extraction stays pending, so the agent can clarify namespace/period/schema. */
export async function archiveCEOFile(filename: string, namespace: CEODataNamespace): Promise<CEOArchiveReceipt | undefined> {
  if (!ceoIntakeEnabled() || !['.csv', '.xlsx', '.pdf', '.txt', '.md'].includes(path.extname(filename).toLowerCase())) return;
  const command = process.env.NERVE_CEO_COMMAND!;
  const state = process.env.NERVE_CEO_STATE_DIR!;
  if (!path.isAbsolute(command) || !path.isAbsolute(state)) throw new Error('CEO intake requires absolute configured paths');
  const env = Object.fromEntries(['HOME', 'PATH', 'LANG', 'LC_ALL', 'TZ'].filter(key => process.env[key]).map(key => [key, process.env[key]!]));
  env.CEO_STATE_DIR = state;
  try {
    const result = await execute(command, ['--namespace', namespace, 'ingest', filename, '--source=nerve:owner-web-upload', '--defer'],
      { env, timeout: 45000, maxBuffer: 1024 * 1024 });
    const receipt = JSON.parse(result.stdout) as { document?: { id?: unknown; status?: string } };
    if (typeof receipt.document?.id !== 'string') throw new Error('Missing archive receipt');
    return { id: receipt.document.id, namespace, status: receipt.document.status || 'pending' };
  } catch {
    throw new Error('Plik zachowano w skrzynce, ale zapis w archiwum CEO nie został potwierdzony. Spróbuj ponownie.');
  }
}
