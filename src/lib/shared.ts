// 伺服器端與瀏覽器端共用的常數與小工具

export const REGION_GROUPS: Record<string, string[]> = {
  北部: ['台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '宜蘭縣'],
  中部: ['苗栗縣', '台中市', '彰化縣', '南投縣', '雲林縣'],
  南部: ['嘉義市', '嘉義縣', '台南市', '高雄市', '屏東縣'],
  東部離島: ['花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣'],
};

export const NATIONWIDE = '全台';
export const ONLINE = '線上';

export type Kind = 'r' | 's';

export const markKey = (kind: Kind, id: string) => `${kind}:${id}`;

export const detailUrl = (kind: Kind, id: string) => `/${kind}/${encodeURIComponent(id)}/`;

export const mapsSearchUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/** 商店實付比例：沒有低消代表可 100% 折抵 */
export function payRatio(minSpend: number | undefined, discount: number) {
  if (!minSpend) return 0;
  return Math.max(0, (minSpend - discount) / minSpend);
}

/** 0.9 -> 「9 折」、0.667 -> 「6.7 折」、0 -> 「免費」 */
export function ratioLabel(r: number) {
  if (r <= 0) return '可全額折抵';
  const n = Math.round(r * 100) / 10;
  return `${Number.isInteger(n) ? n : n.toFixed(1)} 折`;
}

export const money = (n: number) => `$${n.toLocaleString('zh-TW')}`;

/** 資料更新日期超過這個天數就提示可能過期 */
export const STALE_DAYS = 365;

export function isStale(updated: string | undefined, now = new Date()) {
  if (!updated) return true;
  const t = new Date(`${updated}T00:00:00+08:00`).getTime();
  return Number.isNaN(t) || now.getTime() - t > STALE_DAYS * 86400e3;
}
