/**
 * Daily Web Push sender — run from GitHub Actions after prices update.
 *
 * Env:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_KV_NAMESPACE_ID
 *   Optional: PUSH_TITLE, PUSH_BODY, PUSH_URL
 */
import { readFile } from 'node:fs/promises';
import webpush from 'web-push';

const required = [
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_KV_NAMESPACE_ID',
];

for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing env ${k}`);
    process.exit(1);
  }
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@goldmandu.chandanshakya.com.np',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

const CF = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;
const auth = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` };

function npr(n) {
  const s = Math.round(Number(n)).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3;
}

async function payloadFromPrices() {
  const rows = JSON.parse(await readFile('data/prices.json', 'utf8'));
  const latest = rows[rows.length - 1];
  return {
    title: 'GoldMandu — daily rates',
    body: `Fine gold Rs. ${npr(latest.fine_gold_tola)}/tola · Silver Rs. ${npr(latest.silver_tola)}/tola · ${latest.day} ${latest.month} ${latest.year}`,
    url: '/',
  };
}

async function loadPayload() {
  if (process.env.PUSH_BODY) {
    return {
      title: process.env.PUSH_TITLE || 'GoldMandu — daily rates',
      body: process.env.PUSH_BODY,
      url: process.env.PUSH_URL || '/',
    };
  }
  try {
    return await payloadFromPrices();
  } catch (e) {
    console.error('price payload failed', e);
    return { title: 'GoldMandu', body: 'Gold prices updated.', url: '/' };
  }
}

async function listSubIds() {
  const ids = [];
  let cursor = '';
  for (;;) {
    const url = `${CF}/keys?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await fetch(url, { headers: auth });
    const body = await res.json();
    if (!body.success) {
      console.error('KV list failed', body.errors);
      break;
    }
    for (const item of body.result || []) ids.push(item.name);
    if (!body.result_info?.cursor) break;
    cursor = body.result_info.cursor;
  }
  return ids;
}

async function getSub(id) {
  const res = await fetch(`${CF}/values/${encodeURIComponent(id)}`, {
    headers: auth,
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function deleteSub(id) {
  await fetch(`${CF}/values/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: auth,
  });
}

const payload = await loadPayload();
const ids = await listSubIds();
console.log(`Subscriptions: ${ids.length}`);

let ok = 0;
let gone = 0;
for (const id of ids) {
  const sub = await getSub(id);
  if (!sub?.endpoint) continue;
  try {
    const res = await webpush.sendNotification(sub, JSON.stringify(payload));
    if (res.statusCode >= 200 && res.statusCode < 300) ok++;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await deleteSub(id);
      gone++;
    } else {
      console.error(`send ${id}:`, err.statusCode || err.message);
    }
  }
}

console.log(`Push done: ${ok} sent, ${gone} pruned`);
