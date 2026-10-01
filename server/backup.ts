// Consistent copy of the live database: `npm run backup [target-file]`.
import { DatabaseSync } from 'node:sqlite';
import { join, resolve } from 'node:path';

const dataDir = resolve(process.env.DATA_DIR ?? './data');
const target = resolve(process.argv[2] ?? join(dataDir, `backup-${new Date().toISOString().slice(0, 10)}.db`));
const db = new DatabaseSync(join(dataDir, 'whetstone.db'));
db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
db.close();
console.log(`Backup written to ${target}`);
