import { getCollection } from 'astro:content';
import { NATIONWIDE, ONLINE, REGION_GROUPS, payRatio } from './shared';

const KNOWN_REGIONS = new Set([NATIONWIDE, ONLINE, ...Object.values(REGION_GROUPS).flat()]);

function checkRegions(kind: string, id: string, regions: string[] | undefined) {
  for (const r of regions ?? []) {
    if (!KNOWN_REGIONS.has(r)) throw new Error(`[資料錯誤] ${kind}「${id}」的 regions 有未知地區「${r}」，請用 src/lib/shared.ts 裡的縣市名稱`);
  }
}

export async function getRestaurants() {
  const [items, platforms] = await Promise.all([getCollection('restaurants'), getCollection('platforms')]);
  // YAML 解析失敗時 loader 只會留下空集合，這裡擋下來避免發佈空網站
  if (items.length === 0) throw new Error('[資料錯誤] restaurants.yaml 讀不到任何資料，請看上方錯誤訊息');
  const known = new Map(platforms.map((p) => [p.id, p.data]));
  for (const r of items) {
    if (r.data.platform && !known.has(r.data.platform))
      throw new Error(`[資料錯誤] 餐廳「${r.id}」的 platform「${r.data.platform}」不在 platforms.yaml，請先新增平台說明`);
    checkRegions('餐廳', r.id, r.data.regions);
  }
  return {
    items: items.sort((a, b) => b.data.value - a.data.value || a.id.localeCompare(b.id, 'zh-Hant')),
    platforms: known,
  };
}

export async function getShops() {
  const items = await getCollection('shops');
  if (items.length === 0) throw new Error('[資料錯誤] shops.yaml 讀不到任何資料，請看上方錯誤訊息');
  for (const s of items) checkRegions('商店', s.id, s.data.regions);
  return items
    .map((s) => ({ ...s, ratio: payRatio(s.data.minSpend, s.data.discount) }))
    .sort((a, b) => a.ratio - b.ratio || b.data.discount - a.data.discount);
}

export function regionText(regions: string[] | undefined) {
  if (!regions?.length) return '未知';
  if (regions.includes(NATIONWIDE)) return regions.includes(ONLINE) ? '全台・線上' : '全台';
  if (regions.length <= 2) return regions.join('、');
  return `${regions.slice(0, 2).join('、')} 等 ${regions.length} 地`;
}

/** 表格依地區排序用：全台最前，再依 REGION_GROUPS 由北到南，沒填的放最後 */
const REGION_ORDER = [NATIONWIDE, ONLINE, ...Object.values(REGION_GROUPS).flat()];
export function regionRank(regions: string[] | undefined) {
  const ranks = (regions ?? []).map((r) => REGION_ORDER.indexOf(r));
  return ranks.length ? Math.min(...ranks) : REGION_ORDER.length;
}
