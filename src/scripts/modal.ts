// 店家詳細資訊用 modal 開啟：抓靜態詳細頁，取出 .detail 放進 <dialog>。
// 網址同步成詳細頁網址，重新整理或分享連結時就是完整頁面；上一頁會關閉 modal
import { initMarkControls, sync } from './bind';
import { initMiniMap } from './minimap';
import { markStale } from './stale';

const DETAIL = /^\/[rs]\/[^/]+\/$/;
const cache = new Map<string, Promise<{ title: string; node: Element } | null>>();

function load(path: string) {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const node = doc.querySelector('.detail');
        return node ? { title: doc.title, node } : null;
      })
      .catch(() => null);
    p.then((x) => x || cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export function initModal() {
  const dlg = document.getElementById('detail-modal') as HTMLDialogElement | null;
  if (!dlg) return;
  const body = dlg.querySelector<HTMLElement>('.modal-body')!;
  const open = dlg.querySelector<HTMLAnchorElement>('[data-modal-page]')!;
  const baseTitle = document.title;
  const basePath = location.pathname + location.search;
  let cleanup = () => {};
  let pushed = false;
  let seq = 0;

  async function show(path: string, push: boolean) {
    const my = ++seq;
    cleanup();
    body.innerHTML = '<p class="modal-loading">載入中…</p>';
    open.href = path;
    if (!dlg!.open) dlg!.showModal();
    if (push) {
      history.pushState({ modal: path }, '', path);
      pushed = true;
    }
    const got = await load(path);
    if (my !== seq || !dlg!.open) return;
    if (!got) {
      // 抓不到就退回一般換頁
      location.href = path;
      return;
    }
    const node = got.node.cloneNode(true) as HTMLElement;
    body.replaceChildren(node);
    body.scrollTop = 0;
    document.title = got.title;
    initMarkControls();
    sync(body);
    markStale(body);
    cleanup = initMiniMap(body);
    dlg!.querySelector<HTMLElement>('.modal-close')!.focus({ preventScroll: true });
  }

  dlg.addEventListener('close', () => {
    seq++;
    cleanup();
    cleanup = () => {};
    document.title = baseTitle;
    if (pushed && DETAIL.test(location.pathname)) history.back();
    pushed = false;
  });
  // 點 dialog 外面的背景關閉
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.querySelector('.modal-close')!.addEventListener('click', () => dlg.close());

  addEventListener('popstate', () => {
    if (DETAIL.test(location.pathname) && location.pathname !== new URL(basePath, location.href).pathname) {
      show(location.pathname, false);
      pushed = true;
    } else if (dlg.open) {
      pushed = false;
      dlg.close();
    }
  });

  const target = (e: Event) => {
    const a = (e.target as HTMLElement).closest?.('a');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin || !DETAIL.test(a.pathname)) return null;
    return a;
  };
  document.addEventListener('click', (e) => {
    const a = target(e);
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.closest('[data-modal-page]')) return;
    e.preventDefault();
    if (a.pathname === location.pathname && dlg.open) return;
    show(a.pathname, true);
  });
  // 滑過就先抓，點下去幾乎立刻出現
  document.addEventListener('pointerover', (e) => {
    const a = target(e);
    if (a) load(a.pathname);
  });
}
