import { join, resolve } from 'node:path';
import { listen } from './app.ts';
import { openDb } from './db.ts';

const port = Number(process.env.PORT ?? 8787);
const dataDir = resolve(process.env.DATA_DIR ?? './data');
const distDir = resolve(process.env.DIST_DIR ?? './dist');
const db = openDb(join(dataDir, 'whetstone.db'));

const server = await listen({ db, distDir, trustProxy: process.env.TRUST_PROXY === '1' }, port);
console.log(`Whetstone listening on http://localhost:${port}  (data: ${dataDir})`);

const stop = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
