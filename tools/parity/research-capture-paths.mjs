// Where the research captures (reference PNGs and capture logs) live: outside the repo, next to the
// plans, or wherever PARITY_RESEARCH_DIR points.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DEFAULT_RESEARCH_DIR = path.join(REPO_ROOT, '..', 'plans', '260930-train-diorama-clone', 'research');

export function resolveResearchDir(env = process.env) {
  return path.resolve(env.PARITY_RESEARCH_DIR || DEFAULT_RESEARCH_DIR);
}

export function researchCapturePath(fileName, researchDir = resolveResearchDir()) {
  return path.join(researchDir, 'captures', fileName);
}

export function researchSkipReason(researchDir = resolveResearchDir()) {
  const capturesDir = path.join(researchDir, 'captures');
  return existsSync(capturesDir) ? false : `research captures not found at ${capturesDir} — set PARITY_RESEARCH_DIR`;
}
