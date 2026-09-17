/**
 * Generate mobile API payloads from data/prices.json into public/api/.
 * Static files on Cloudflare Pages — no Function runtime required.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'data', 'prices.json');
const outDir = join(root, 'public', 'api');

const HISTORY_DAYS = 90;

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function validRecord(r) {
  return r && num(r.fine_gold_tola) != null;
}

function pct(change, prev) {
  if (change == null || !prev) return null;
  return Number(((change / prev) * 100).toFixed(2));
}

function buildLatest(records) {
  const valid = records.filter(validRecord);
  if (!valid.length) throw new Error('no valid price records');
  const latest = valid[valid.length - 1];
  const prev = valid.length >= 2 ? valid[valid.length - 2] : null;

  const fineT = num(latest.fine_gold_tola);
  const tejabiT = num(latest.tejabi_gold_tola);
  const silverT = num(latest.silver_tola);
  const prevFine = prev ? num(prev.fine_gold_tola) : null;
  const prevTejabi = prev ? num(prev.tejabi_gold_tola) : null;
  const prevSilver = prev ? num(prev.silver_tola) : null;

  const fineChg = fineT != null && prevFine != null ? fineT - prevFine : null;
  const tejabiChg =
    tejabiT != null && prevTejabi != null ? tejabiT - prevTejabi : null;
  const silverChg =
    silverT != null && prevSilver != null ? silverT - prevSilver : null;

  return {
    bs: `${latest.day} ${latest.month} ${latest.year}`,
    day: latest.day,
    month: latest.month,
    year: latest.year,
    fine_gold_tola: fineT,
    fine_gold_gram: num(latest.fine_gold_gram),
    tejabi_gold_tola: tejabiT,
    tejabi_gold_gram: num(latest.tejabi_gold_gram),
    silver_tola: silverT,
    silver_gram: num(latest.silver_gram),
    change: {
      fine_gold_tola: fineChg,
      fine_gold_tola_pct: pct(fineChg, prevFine),
      tejabi_gold_tola: tejabiChg,
      tejabi_gold_tola_pct: pct(tejabiChg, prevTejabi),
      silver_tola: silverChg,
      silver_tola_pct: pct(silverChg, prevSilver),
    },
    generated_at: new Date().toISOString(),
  };
}

function buildHistory(records) {
  const valid = records.filter(validRecord).slice(-HISTORY_DAYS);
  return {
    count: valid.length,
    unit: 'npr',
    note: 'gram fields are association per-10-gram rates',
    points: valid.map((r) => ({
      d: `${r.year}-${r.month}-${r.day}`,
      ft: num(r.fine_gold_tola),
      tt: num(r.tejabi_gold_tola),
      st: num(r.silver_tola),
    })),
    generated_at: new Date().toISOString(),
  };
}

const records = JSON.parse(readFileSync(src, 'utf8'));
if (!Array.isArray(records) || records.length === 0) {
  console.error('prices.json empty');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const latest = buildLatest(records);
const history = buildHistory(records);

const latestPath = join(outDir, 'latest.json');
const historyPath = join(outDir, 'history.json');
writeFileSync(latestPath, JSON.stringify(latest));
writeFileSync(historyPath, JSON.stringify(history));

console.log(`api latest -> ${latestPath} (${JSON.stringify(latest).length} B)`);
console.log(
  `api history -> ${historyPath} (${JSON.stringify(history).length} B, ${history.count} pts)`,
);
