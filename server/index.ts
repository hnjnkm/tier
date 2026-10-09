import express from 'express';
import { resolve } from 'node:path';
import { createApp } from './app';

const app = createApp();
const production = process.argv.includes('--production');
const port = Number(process.env.PORT || 5173);
let viteServer: { close: () => Promise<void> } | undefined;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');

if (production) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  viteServer = vite;
  app.use(vite.middlewares);
}

const server = app.listen(port, process.env.HOST || '0.0.0.0');
server.on('listening', () => console.log(`my tier. listening on port ${port} (${production ? 'production' : 'development'})`));
server.on('error', error => { console.error(error.message); process.exit(1); });
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, async () => {
  if (stopping) return;
  stopping = true;
  await viteServer?.close();
  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 2000).unref();
});
