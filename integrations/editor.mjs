// 只在 `npm run dev` 啟用的資料編輯器：/edit 頁面 + /__edit/api 寫回 src/data/*.yaml
// build 時不注入，所以不會出現在 dist；build 只做 YAML 檢查
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const FILES = {
  restaurants: 'src/data/restaurants.yaml',
  shops: 'src/data/shops.yaml',
  platforms: 'src/data/platforms.yaml',
};

const hash = (s) => createHash('sha1').update(s).digest('hex');

/** 檔案開頭的註解原樣保留 */
function splitHeader(text) {
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('#') || lines[i].trim() === '')) i++;
  return lines.slice(0, i).join('\n').trimEnd();
}

/** 和手寫 YAML 一致：店家之間空一行、regions 用 [a, b] */
export function toYaml(header, entries) {
  const doc = new YAML.Document(Object.fromEntries(entries.map(({ id, ...rest }) => [id, rest])));
  doc.contents.items.forEach((pair, i) => {
    if (i > 0) pair.key.spaceBefore = true;
  });
  YAML.visit(doc, {
    Pair(_, pair) {
      if (pair.key?.value === 'regions' && YAML.isSeq(pair.value)) pair.value.flow = true;
    },
  });
  const body = doc.toString({ lineWidth: 0, flowCollectionPadding: false });
  return (header ? header + '\n\n' : '') + body;
}

const UA = 'hbd-duckll-editor/1.0 (github.com/DuckLL/birthday_offer)';
const ADDR = /^(.{2}[市縣])(.{1,3}?[區鄉鎮市])(.+?(?:路|街|大道)(?:[一二三四五六七八九]段)?)((?:\d+巷)?(?:\d+弄)?)(\d+)(?:[-之]\d+)?號/;

async function nominatim(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tw&q=${encodeURIComponent(q)}`, {
    headers: { 'User-Agent': UA },
  });
  return (await r.json())[0];
}

/** OSM 對台灣門牌的格式要求：「路 號, 區, 市」並用「臺」 */
async function geocode(addr) {
  const T = (s) => s.replace(/台/g, '臺');
  const m = addr.match(ADDR);
  if (m) {
    const [, city, dist, road, lane, num] = m;
    let hit = await nominatim(`${T(road)}${lane} ${num}, ${dist}, ${T(city)}`);
    if (!hit && lane) hit = await nominatim(`${T(road)} ${num}, ${dist}, ${T(city)}`);
    if (hit) return { lat: +hit.lat, lng: +hit.lon, approx: hit.class === 'highway' };
    hit = await nominatim(`${T(road)}, ${dist}, ${T(city)}`);
    if (hit) return { lat: +hit.lat, lng: +hit.lon, approx: true };
  }
  const hit = await nominatim(T(addr));
  return hit ? { lat: +hit.lat, lng: +hit.lon, approx: hit.class === 'highway' } : null;
}

const round = (n) => Math.round(n * 1e5) / 1e5;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export default function editor() {
  let root = '';
  return {
    name: 'hbd-editor',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, config }) => {
        root = fileURLToPath(config.root);
        if (command === 'dev') injectRoute({ pattern: '/edit', entrypoint: new URL('../src/editor/edit.astro', import.meta.url) });
      },
      // content loader 解析失敗時會沿用 .astro 快取的舊資料而不報錯，build 前先擋下
      'astro:build:start': async () => {
        for (const file of Object.values(FILES)) {
          try {
            YAML.parse(await fs.readFile(path.join(root, file), 'utf8'));
          } catch (e) {
            throw new Error(`[資料錯誤] ${file}：${e.message}`);
          }
        }
      },
      'astro:server:setup': ({ server, logger }) => {
        server.middlewares.use('/__edit/api', async (req, res) => {
          try {
            const url = new URL(req.url, 'http://x');
            const [, kind, name] = url.pathname.split('/');
            if (kind === 'geocode') {
              const r = await geocode(url.searchParams.get('q') ?? '');
              return send(res, r ? 200 : 404, r ? { lat: round(r.lat), lng: round(r.lng), approx: r.approx } : { error: '找不到這個地址' });
            }
            const file = FILES[name];
            if (kind !== 'data' || !file) return send(res, 404, { error: 'not found' });
            const abs = path.join(root, file);
            const text = await fs.readFile(abs, 'utf8');
            if (req.method === 'GET') {
              const data = YAML.parse(text) ?? {};
              return send(res, 200, { hash: hash(text), entries: Object.entries(data).map(([id, v]) => ({ id, ...v })) });
            }
            if (req.method === 'PUT') {
              const body = await readBody(req);
              // 有人（例如 agent）在編輯器開著時改了檔案，就拒絕覆蓋
              if (body.hash !== hash(text)) return send(res, 409, { error: '檔案在你編輯期間被修改過了，請重新載入後再存。' });
              const ids = body.entries.map((e) => String(e.id ?? '').trim());
              const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
              if (ids.some((id) => !id)) return send(res, 400, { error: '有店家沒有名稱' });
              if (dup.length) return send(res, 400, { error: `店家名稱重複：${[...new Set(dup)].join('、')}` });
              const out = toYaml(splitHeader(text), body.entries.map((e, i) => ({ ...e, id: ids[i] })));
              await fs.writeFile(abs, out);
              logger.info(`已寫入 ${file}（${ids.length} 筆）`);
              return send(res, 200, { hash: hash(out) });
            }
            send(res, 405, { error: 'method not allowed' });
          } catch (e) {
            logger.error(String(e));
            send(res, 500, { error: String(e.message ?? e) });
          }
        });
      },
    },
  };
}
