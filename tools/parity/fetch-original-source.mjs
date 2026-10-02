#!/usr/bin/env node
// Populates .parity-cache/original/ (gitignored oracle, never shipped) via an atomic temp+rename swap.
import { mkdir, readFile, writeFile, rm, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const PARITY_CACHE_DIR = fileURLToPath(new URL('../../.parity-cache/', import.meta.url));
const OUTPUT_DIR = path.join(PARITY_CACHE_DIR, 'original');

// Pinned against the original deployment, 2026-09-30.
const PINNED_FILES = [
  ['index.html', 'fc319d17cc7f5d7f46c5777420ff97d29557792103bfda5fb6876cfbe06d2094'],
  ['Styles.css', '260aa543bc6ea6248ecd16b976ef2dbbfb329d832e08a33b6ac104a24d41bae6'],
  ['TrainScene.js', '5fd2108ee38c812f53e15eb0e958b83d83ae25e5360f7d53be1c64c95f32671b'],
  ['LoadingScreen.js', 'dac7e1153c039d18f81810aae2a2cf64e264dcd3f5b42bcce6b59decaf3af7b8'],
  ['Diorama.js', 'd6071ccfb42a9e62320314ea85af5a0acd67b25f8b6cf86f374c0be1f7cef7e3'],
  ['Materials.js', '69434f71f25897c34e125fbc6be2faa88525af07c96dffd5956e84c4870c2aa5'],
  ['Noise.js', '2292db8b8c92a3c5830750eb4ecd3b15f38231801f01b4f879dc18725900b392'],
  ['StaticGeometry.js', '321cc2fa1eb21876a792c417ebb79d7295fb30daeab5e00a8ac67b55ea135eab'],
  ['LightGlows.js', 'baac9cd76675ef91a8920e43805930f96a96dcafc08662401fb616fa46b711e1'],
  ['World.js', '1694a3f4008e6ee6ca2a94e7f14835c1652e309d425a5a79036c78cd93b91cfe'],
  ['Train.js', '45612e49d77744f4e405bc0c67b26b19831ca0f115e09b27c45c7f9327ef3707'],
  ['BrakeSparks.js', 'e984898fc6215c70df3e512832ff982bd1a951975d549dca42ecaacf76ce2c8a'],
  ['BirdSystem.js', '4e4532a07256f6584d368aa9bfc9bca0102bc247871efb5457ee9cf243ece6d5'],
  ['TrackSheep.js', '2cc2f0f500d9dbe580f86e07f9ea01330dab2dd26965eac7bb5c2421b5b69f07'],
  ['StationWalker.js', 'ac8dcf983026eca6b0e775306351a5bfa118d74dd7ca519a733176be09b1f735'],
  ['VillageResidents.js', 'f7a9dcdca0fc7488eab6a8dff81d1079f110fe1abaa4664ae4e4938682be8332'],
  ['TrainDiorama_Logo.svg', '39559ab53abac21a5a7798262a50f326fd36c9cab13ac97d9ef13744636226e2'],
  ['ClockFavicon.svg', 'd96dfdeeaea7460743dfdcf957aca3ba9a68a41ac928bc29688cd34d1bfb7012'],
];

function parseArgs(argv) {
  const options = { url: null, from: null, strict: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') options.url = requireFlagValue(argv, ++i, '--url');
    else if (argv[i] === '--from') options.from = requireFlagValue(argv, ++i, '--from');
    else if (argv[i] === '--strict') options.strict = true;
  }
  return options;
}

// Rejects a missing or option-looking value, so a typo'd flag never silently falls back to a default.
function requireFlagValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function sha256Of(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readFromSnapshot(dir, name) {
  const filePath = path.join(dir, name);
  const { size } = await stat(filePath);
  if (size > MAX_BYTES) throw new Error(`body exceeds ${MAX_BYTES} bytes`);
  return await readFile(filePath);
}

// Reads the body in chunks so an oversized response is rejected mid-stream, never fully
// buffered first (a declared Content-Length is checked up front as a cheap early-out too).
async function readFromNetwork(base, name) {
  const response = await fetch(new URL(name, base), {
    redirect: 'error',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    throw new Error(`body exceeds ${MAX_BYTES} bytes`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`body exceeds ${MAX_BYTES} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
}

// Parses and normalises the base URL (http/https only, forced trailing slash); throws on
// an invalid URL or an unsupported protocol instead of leaking an unhandled rejection.
function resolveBaseUrl(raw) {
  const parsed = new URL(raw);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error(`unsupported protocol: ${parsed.protocol}`);
  parsed.pathname = parsed.pathname.replace(/\/?$/, '/');
  return parsed;
}

// Writes into a sibling temp directory first, then renames it over OUTPUT_DIR, so a crash
// mid-write never leaves a mix of new and old files under a stale manifest.
async function writeOutputAtomically(collected, manifest) {
  const tmpDir = path.join(PARITY_CACHE_DIR, `original.tmp-${process.pid}`);
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });
  for (const entry of collected) await writeFile(path.join(tmpDir, entry.name), entry.bytes);
  await writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await rename(tmpDir, OUTPUT_DIR);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log(`[PARITY] ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const { url, from, strict } = options;
  let base = null;
  let source = from;
  if (!from) {
    try {
      base = resolveBaseUrl(url ?? process.env.TARGET_URL ?? 'https://train-diorama.vercel.app/');
    } catch (error) {
      console.log(`[PARITY] could not resolve --url: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    source = base.href;
  }

  const collected = [];
  let failed = false;
  for (const [name, pinnedSha] of PINNED_FILES) {
    let bytes;
    try {
      bytes = from ? await readFromSnapshot(from, name) : await readFromNetwork(base, name);
    } catch (error) {
      console.log(`[PARITY] ${name} could not be read: ${error.message}`);
      failed = true;
      continue;
    }
    const sha256 = sha256Of(bytes);
    const matchesPinned = sha256 === pinnedSha;
    if (strict && !matchesPinned) {
      console.log(`[PARITY] ${name} differs from pinned snapshot`);
      failed = true;
      continue;
    }
    if (!matchesPinned) console.log(`[PARITY] ${name} differs from pinned snapshot (continuing, --strict not set)`);
    collected.push({ name, bytes, sha256, matchesPinned });
  }
  if (failed) { process.exitCode = 1; return; }

  const manifest = {
    source,
    fetchedAt: new Date().toISOString(),
    files: collected.map(({ name, bytes, sha256, matchesPinned }) => ({ name, bytes: bytes.byteLength, sha256, matchesPinned })),
  };
  await writeOutputAtomically(collected, manifest);
  console.log(`[PARITY] Cached ${collected.length} original files from ${source}`);
}

await main();
