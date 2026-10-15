import { Hono } from 'hono';
import { rateLimitGeneral } from '../middleware/rate-limit.js';
import { getUploadFeatureConfig } from '../lib/upload-config.js';
import { ceoIntakeEnabled } from '../lib/ceo-intake.js';

const app = new Hono();

app.get('/api/upload-config', rateLimitGeneral, (c) => c.json({ ...getUploadFeatureConfig(), ...(ceoIntakeEnabled() ? { ceoIntakeEnabled: true } : {}) }));

export default app;
