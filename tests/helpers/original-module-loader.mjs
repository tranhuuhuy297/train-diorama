// Guarded access to the gitignored original-source oracle, plus a GLSL interface extractor that
// compares shader signatures without ever storing or comparing the original's text. Never imported from src/.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const ORIGINAL_SOURCE_DIRECTORY = fileURLToPath(new URL('../../.parity-cache/original/', import.meta.url));

export function originalSkipReason(fileNames) {
  const missing = fileNames.filter(name => !existsSync(ORIGINAL_SOURCE_DIRECTORY + name));
  if (missing.length === 0) return false;
  return `original source cache missing (${missing.join(', ')}); run npm run parity:fetch`;
}

export function importOriginal(fileName) {
  return import(pathToFileURL(path.join(ORIGINAL_SOURCE_DIRECTORY, fileName)).href);
}

const DIRECTIVE_LINE = /^#(ifdef|ifndef|if|elif|else|endif)\b\s*(\w+)?/;
const UNIFORM_LINE = /^uniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*;/;
const ATTRIBUTE_LINE = /^attribute\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*;/;
const FUNCTION_START = /^(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{?/;

function stripLineComment(line) {
  const at = line.indexOf('//');
  return (at === -1 ? line : line.slice(0, at)).trim();
}

function paramTypes(paramList) {
  if (!paramList.trim()) return [];
  return paramList.split(',').map(p => p.trim().split(/\s+/).filter(Boolean)[0]);
}

/** Extracts the active uniform/attribute declarations, #ifdef names and function
 * signatures from raw GLSL source, given which #ifdef names are considered active. */
export function extractGlslInterface(source, activeDefines = []) {
  const active = new Set(activeDefines);
  const uniforms = new Set();
  const attributes = new Set();
  const functions = new Set();
  const conditionals = new Set();
  const conditionStack = [];
  let braceDepth = 0;
  let insideFunctionBody = false;

  for (const rawLine of source.split('\n')) {
    const line = stripLineComment(rawLine);
    const directive = line.match(DIRECTIVE_LINE);
    if (directive) {
      const [, kind, name] = directive;
      if (kind === 'ifdef' || kind === 'ifndef') {
        conditionals.add(name);
        const holds = active.has(name);
        conditionStack.push({ active: kind === 'ifdef' ? holds : !holds, neutral: false });
      } else if (kind === 'if') {
        // #if conditions are not evaluated; push a neutral frame so its own #else/#endif
        // pair with this level instead of leaking into an enclosing #ifdef's frame.
        conditionStack.push({ active: true, neutral: true });
      } else if (kind === 'elif') {
        // Same nesting level as the #if it follows: nothing to push or pop here.
      } else if (kind === 'else') {
        const frame = conditionStack.pop();
        conditionStack.push(frame.neutral ? frame : { active: !frame.active, neutral: false });
      } else if (kind === 'endif') {
        conditionStack.pop();
      }
      continue;
    }
    const isActive = conditionStack.every(frame => frame.active);
    if (!isActive || !line) continue;

    if (!insideFunctionBody && braceDepth === 0) {
      // Declarations may be semicolon-joined several to a line; test each statement on its own.
      for (const statement of line.split(';')) {
        const candidate = `${statement.trim()};`;
        const uniform = candidate.match(UNIFORM_LINE);
        if (uniform) { uniforms.add(`${uniform[1]} ${uniform[2]}`); continue; }
        const attribute = candidate.match(ATTRIBUTE_LINE);
        if (attribute) attributes.add(`${attribute[1]} ${attribute[2]}`);
      }
      const fn = line.match(FUNCTION_START);
      if (fn && line.includes('{') && fn[2] !== 'main') {
        functions.add(`${fn[1]} ${fn[2]}(${paramTypes(fn[3]).join(',')})`);
      }
    }
    for (const ch of line) {
      if (ch === '{') { braceDepth++; insideFunctionBody = true; }
      else if (ch === '}') { braceDepth--; if (braceDepth <= 0) { braceDepth = 0; insideFunctionBody = false; } }
    }
  }

  return {
    uniforms: [...uniforms].sort(),
    attributes: [...attributes].sort(),
    functions: [...functions].sort(),
    conditionals: [...conditionals].sort(),
  };
}
