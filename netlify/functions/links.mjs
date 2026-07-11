import { getStore } from '@netlify/blobs';

const KEY = 'links.json';
const MAX_LINKS = 500;
const MAX_NAME_LEN = 200;
const MAX_URL_LEN = 2000;
const MAX_IMAGE_LEN = 3_000_000; // ~2.2MB decoded, generous for a resized JPEG
const IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isValidUrl(u) {
  if (typeof u !== 'string' || !u || u.length > MAX_URL_LEN) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateLinks(body) {
  if (!Array.isArray(body)) return 'body must be an array of links';
  if (body.length > MAX_LINKS) return `too many links (max ${MAX_LINKS})`;
  for (const entry of body) {
    if (!entry || typeof entry !== 'object') return 'each link must be an object';
    if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > MAX_NAME_LEN) {
      return 'each link needs a non-empty name';
    }
    const hasUrl = entry.url !== undefined && entry.url !== null && entry.url !== '';
    const hasImage = entry.image !== undefined;
    if (!hasUrl && !hasImage) return 'each link needs a url or an image';
    if (hasUrl && !isValidUrl(entry.url)) return `invalid url: ${String(entry.url).slice(0, 100)}`;
    if (hasImage) {
      if (typeof entry.image !== 'string' || entry.image.length > MAX_IMAGE_LEN || !IMAGE_RE.test(entry.image)) {
        return 'image must be a valid data:image/* base64 URL within size limits';
      }
    }
    const allowedKeys = new Set(['name', 'url', 'image']);
    if (Object.keys(entry).some((k) => !allowedKeys.has(k))) return 'link objects may only contain name, url, image';
  }
  return null;
}

export default async function handler(req) {
  const store = getStore('link-board');

  if (req.method === 'GET') {
    const data = await store.get(KEY, { type: 'json' });
    return json(Array.isArray(data) ? data : []);
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const expected = process.env.LINK_BOARD_TOKEN;
    if (!expected) return json({ error: 'server not configured (missing LINK_BOARD_TOKEN)' }, 500);
    if (req.headers.get('x-link-board-token') !== expected) return json({ error: 'unauthorized' }, 401);

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }
    const err = validateLinks(body);
    if (err) return json({ error: err }, 400);

    await store.setJSON(KEY, body);
    return json({ ok: true, count: body.length });
  }

  return json({ error: 'method not allowed' }, 405);
}
