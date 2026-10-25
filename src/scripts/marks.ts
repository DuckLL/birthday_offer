// 使用者自己的標記，只存在這台裝置的 localStorage
export type Status = 'want' | 'done';
export interface Mark {
  status?: Status;
  plan?: string; // YYYY-MM-DD
  note?: string;
  doneAt?: string; // YYYY-MM-DD
  updated: string; // ISO
}
export type Marks = Record<string, Mark>;

const KEY = 'hbd:marks:v1';
const EVENT = 'hbd:marks';

let cache: Marks | null = null;

export function loadMarks(): Marks {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || '{}') as Marks;
  } catch {
    cache = {};
  }
  return cache;
}

function save(m: Marks) {
  cache = m;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // 無痕模式或儲存被封鎖：只保留在記憶體
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function getMark(key: string): Mark | undefined {
  return loadMarks()[key];
}

export function updateMark(key: string, patch: Partial<Omit<Mark, 'updated'>>) {
  const all = { ...loadMarks() };
  const next: Mark = { ...all[key], ...patch, updated: new Date().toISOString() };
  if (patch.status === 'done' && !next.doneAt) next.doneAt = today();
  if (patch.status !== undefined && patch.status !== 'done') delete next.doneAt;
  for (const k of ['status', 'plan', 'note', 'doneAt'] as const) if (!next[k]) delete next[k];
  if (!next.status && !next.plan && !next.note) delete all[key];
  else all[key] = next;
  save(all);
}

export function toggleStatus(key: string, s: Status) {
  updateMark(key, { status: getMark(key)?.status === s ? undefined : s });
}

export function onMarksChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  // 其他分頁改了也同步
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  });
}

export function replaceMarks(m: Marks) {
  save(m);
}

export function mergeMarks(m: Marks) {
  const all = { ...loadMarks() };
  for (const [k, v] of Object.entries(m)) {
    if (!all[k] || (v.updated || '') > (all[k].updated || '')) all[k] = v;
  }
  save(all);
}

export function isValidMarks(x: unknown): x is Marks {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.entries(x).every(
    ([k, v]) => /^[rs]:/.test(k) && v && typeof v === 'object' && (!('status' in v) || ['want', 'done', undefined].includes((v as Mark).status)),
  );
}
