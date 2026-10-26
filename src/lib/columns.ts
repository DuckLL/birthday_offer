// 桌機表格欄位：key 對應表頭與儲存格的 data-c；w 是一般寬度，narrow 是 1101–1240px 的寬度
// 使用者可在「欄位」選單調整順序與顯示、在表頭調整寬度，存在 localStorage（見 scripts/columns.ts）
import type { Kind } from './shared';

export interface Column {
  key: string;
  label: string;
  w: string;
  narrow: string;
  locked?: boolean; // 不能隱藏
}

export const COLUMNS: Record<Kind, Column[]> = {
  r: [
    { key: 'name', label: '店家', w: 'minmax(170px, 2fr)', narrow: 'minmax(150px, 2fr)', locked: true },
    { key: 'cat', label: '類型', w: '72px', narrow: '72px' },
    { key: 'plat', label: '平台', w: '92px', narrow: '88px' },
    { key: 'offer', label: '優惠', w: 'minmax(150px, 2fr)', narrow: 'minmax(140px, 2fr)' },
    { key: 'value', label: '價值', w: '76px', narrow: '72px' },
    { key: 'period', label: '期限', w: '72px', narrow: '68px' },
    { key: 'region', label: '地區', w: 'minmax(84px, 1fr)', narrow: 'minmax(76px, 1fr)' },
    { key: 'updated', label: '更新', w: '92px', narrow: '88px' },
    { key: 'marks', label: '我的標記', w: '236px', narrow: '128px' },
  ],
  s: [
    { key: 'name', label: '商店', w: 'minmax(150px, 2fr)', narrow: 'minmax(140px, 2fr)', locked: true },
    { key: 'cat', label: '類型', w: '72px', narrow: '72px' },
    { key: 'min', label: '低消', w: '76px', narrow: '72px' },
    { key: 'value', label: '折抵', w: '76px', narrow: '72px' },
    { key: 'ratio', label: '實付比例', w: 'minmax(130px, 1.4fr)', narrow: 'minmax(120px, 1.4fr)' },
    { key: 'region', label: '地區', w: 'minmax(84px, 1fr)', narrow: 'minmax(76px, 1fr)' },
    { key: 'updated', label: '更新', w: '92px', narrow: '88px' },
    { key: 'marks', label: '我的標記', w: '236px', narrow: '128px' },
  ],
};
