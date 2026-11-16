import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await pool.query(readFileSync(join(dir, f), 'utf8'));
  console.log('aplicada:', f);
}
await pool.end();
