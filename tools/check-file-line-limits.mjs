// Fails the build if any source file grows past the 200-line budget.
import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

const ROOTS = ['src', 'styles', 'tools', 'tests'];
const EXTRA_FILES = ['index.html'];
const EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html']);
const LIMIT = 200;
const REPO_ROOT = new URL('..', import.meta.url).pathname;

async function walk(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (EXTENSIONS.has(extname(entry.name))) files.push(full);
  }
  return files;
}

function countLines(text) {
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

const files = [];
for (const root of ROOTS) files.push(...await walk(join(REPO_ROOT, root)));
for (const extra of EXTRA_FILES) files.push(join(REPO_ROOT, extra));

let max = 0;
let maxFile = '';
let failed = false;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  const lines = countLines(text);
  const relativePath = relative(REPO_ROOT, file);
  if (lines > max) { max = lines; maxFile = relativePath; }
  if (lines >= LIMIT) {
    console.log(`${relativePath}: ${lines} lines (must be < 200)`);
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`OK: ${files.length} files, max ${max} lines (${maxFile})`);
}
