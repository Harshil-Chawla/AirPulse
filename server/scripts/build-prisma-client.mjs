import { readdir, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';

// Emit plain ESM beside Prisma's generated TypeScript for the deployed Node runtime.
async function compile(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await compile(path);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            const source = await readFile(path, 'utf8');
            const javascript = stripTypeScriptTypes(source)
                .replace(/(from\s*["']\.[^"']*)\.ts(["'])/g, '$1.js$2')
                .replace(/(import\s*\(\s*["']\.[^"']*)\.ts(["'])/g, '$1.js$2');
            await writeFile(path.replace(/\.ts$/, '.js'), javascript);
        }
    }
}
await compile(new URL('../src/generated/prisma/', import.meta.url).pathname);
console.log('Generated Prisma JavaScript runtime files.');
