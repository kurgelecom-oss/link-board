import { getStore } from '@netlify/blobs';

const KEY = 'links.json';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const store = getStore('link-board');

  if (req.method === 'GET') {
    const data = await store.get(KEY, { type: 'json' });
    return json(Array.isArray(data) ? data : []);
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }
    if (!Array.isArray(body)) return json({ error: 'body must be an array of links' }, 400);
    await store.setJSON(KEY, body);
    return json({ ok: true, count: body.length });
  }

  return json({ error: 'method not allowed' }, 405);
}
