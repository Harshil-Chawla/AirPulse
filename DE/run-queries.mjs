import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
// Support both the staging location server/DE and the required root-level DE.
const serverManifest = existsSync(new URL('../server/package.json', import.meta.url))
    ? new URL('../server/package.json', import.meta.url)
    : new URL('../package.json', import.meta.url);
const { Client } = createRequire(serverManifest)('pg');
import { readFile, writeFile } from 'node:fs/promises';

if (!process.env.DATABASE_URL) throw new Error('Load your private DATABASE_URL environment file first.');
const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
const output = [`Actual DE SQL execution: ${new Date().toISOString()}`, 'Dataset: isolated airpulse_de_recording schema; rolled back after execution.'];
try {
    await client.connect();
    await client.query(await readFile(new URL('./sample-records/fixture.sql', import.meta.url), 'utf8'));
    const sql = await readFile(new URL('./queries.sql', import.meta.url), 'utf8');
    for (const section of sql.split(/(?=^-- Q\d+)/m).filter(s => s.trim())) {
        const label = section.split('\n')[0];
        const result = await client.query(section);
        output.push(label);
        for (const item of Array.isArray(result) ? result : [result]) {
            output.push(`${item.command}: ${item.rowCount} row(s)`, JSON.stringify(item.rows, null, 2));
        }
    }
    await client.query('ROLLBACK');
    output.push('ROLLBACK completed. No demonstration records or schema retained.');
    await writeFile(new URL('./evidence/query-execution.txt', import.meta.url), output.join('\n') + '\n');
    console.log('All 12 operations executed; actual outputs saved in DE/evidence/query-execution.txt');
} catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Do not print connection strings or driver objects containing credentials.
    console.error('DE query execution failed. No success evidence written. Database error code:', error.code || 'unknown');
    process.exitCode = 1;
} finally {
    await client.end().catch(() => {});
}
