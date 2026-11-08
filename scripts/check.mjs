import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const errors = [];
let assetChecks = 0;
let anchorChecks = 0;

function fail(file, message) {
  errors.push(`${path.relative(root, file)}: ${message}`);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(location));
    else result.push(location);
  }
  return result;
}

function decode(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const names = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (entity.toLowerCase() in names) return names[entity.toLowerCase()];
    const hex = entity.toLowerCase().startsWith('&#x');
    return String.fromCodePoint(parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10));
  });
}

function elements(source) {
  const result = [];
  const clean = source.replace(/<!--[\s\S]*?-->/g, '');
  const tags = /<([a-z][\w:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  for (const match of clean.matchAll(tags)) {
    const attrs = {};
    const attributes = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    for (const attr of match[2].matchAll(attributes)) {
      attrs[attr[1].toLowerCase()] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    result.push({ tag: match[1].toLowerCase(), attrs });
  }
  return result;
}

const files = await walk(root);
const documents = new Map();
for (const file of files.filter(file => /\.(?:html|svg)$/i.test(file))) {
  const source = await readFile(file, 'utf8');
  const nodes = elements(source);
  const ids = new Map();
  for (const node of nodes) {
    if (!Object.hasOwn(node.attrs, 'id')) continue;
    const id = node.attrs.id;
    if (!id) fail(file, 'Empty id attribute.');
    if (ids.has(id)) fail(file, `Duplicate id "${id}".`);
    ids.set(id, node);
  }
  documents.set(path.resolve(file), { source, nodes, ids });
}

async function checkReference(file, reference, kind) {
  const value = reference.trim();
  if (!value) {
    fail(file, `Empty ${kind}.`);
    return;
  }
  if (/^(?:javascript|vbscript):/i.test(value) || value === '#' || value === '#!') {
    fail(file, `Placeholder or executable ${kind}: ${value}`);
    return;
  }
  if (/^(?:https?:)?\/\//i.test(value)) {
    try { new URL(value.startsWith('//') ? `https:${value}` : value); }
    catch { fail(file, `Invalid external URL: ${value}`); }
    return;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return;

  const [urlPath, fragment] = value.split('#', 2);
  let pathname;
  let anchor;
  try {
    pathname = decodeURIComponent(urlPath.split('?')[0]);
    anchor = fragment === undefined ? undefined : decodeURIComponent(fragment);
  } catch {
    fail(file, `Invalid URL encoding in ${kind}: ${value}`);
    return;
  }
  let target = pathname
    ? path.resolve(pathname.startsWith('/') ? root : path.dirname(file), pathname.replace(/^\/+/, ''))
    : path.resolve(file);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(file, `${kind} escapes dist: ${value}`);
    return;
  }
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    if (!(await stat(target)).isFile()) throw new Error('Not a file');
    assetChecks++;
  } catch {
    fail(file, `Missing local ${kind}: ${value}`);
    return;
  }
  if (anchor !== undefined) {
    anchorChecks++;
    const targetDocument = documents.get(path.resolve(target));
    if (targetDocument && !targetDocument.ids.has(anchor)) {
      fail(file, `Missing anchor target in ${path.relative(root, target)}: #${anchor}`);
    }
  }
}

for (const [file, document] of documents) {
  for (const { attrs } of document.nodes) {
    for (const name of ['href', 'src']) {
      if (Object.hasOwn(attrs, name)) await checkReference(file, attrs[name], name);
    }
    if (attrs.target?.toLowerCase() === '_blank' && !attrs.rel?.toLowerCase().split(/\s+/).includes('noopener')) {
      fail(file, 'A target="_blank" link is missing rel="noopener".');
    }
  }

  const tabs = document.nodes.filter(node => node.attrs.role === 'tab');
  const panels = document.nodes.filter(node => node.attrs.role === 'tabpanel');
  const linkedPanels = new Set();
  for (const { attrs } of tabs) {
    const panel = document.ids.get(attrs['aria-controls']);
    if (!attrs.id || !panel || panel.attrs.role !== 'tabpanel') {
      fail(file, `Tab ${attrs.id || '(missing id)'} must control an existing tabpanel.`);
      continue;
    }
    if (linkedPanels.has(attrs['aria-controls'])) fail(file, `Multiple tabs control ${attrs['aria-controls']}.`);
    linkedPanels.add(attrs['aria-controls']);
    if (!panel.attrs['aria-labelledby']?.split(/\s+/).includes(attrs.id)) {
      fail(file, `Panel ${attrs['aria-controls']} does not identify its controlling tab.`);
    }
    if (!['true', 'false'].includes(attrs['aria-selected'])) fail(file, `Tab ${attrs.id} needs aria-selected.`);
    const selected = attrs['aria-selected'] === 'true';
    if (attrs.tabindex !== (selected ? '0' : '-1')) fail(file, `Tab ${attrs.id} has an incorrect initial tabindex.`);
    if (Object.hasOwn(panel.attrs, 'hidden') === selected) fail(file, `Panel ${attrs['aria-controls']} has an incorrect initial visibility.`);
  }
  for (const panel of panels) {
    if (!linkedPanels.has(panel.attrs.id)) fail(file, `Tabpanel ${panel.attrs.id || '(missing id)'} has no controlling tab.`);
  }
  if (tabs.length && tabs.filter(tab => tab.attrs['aria-selected'] === 'true').length !== 1) {
    fail(file, 'Exactly one pipeline tab must be selected initially.');
  }
}

for (const file of files.filter(file => /\.css$/i.test(file))) {
  const source = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of source.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    await checkReference(file, match[1] ?? match[2] ?? match[3], 'CSS url');
  }
}

if (errors.length) {
  console.error(`Static checks failed (${errors.length}):\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  const pdfCount = files.filter(file => /\.pdf$/i.test(file)).length;
  console.log(`Static checks passed: ${assetChecks} local references, ${anchorChecks} anchors, matching tabs, safe new-tab links, ${pdfCount} PDF assets.`);
}
