// 詳細資訊裡的小地圖。詳細頁與 modal 共用；回傳清除函式給 modal 關閉時用
export function initMiniMap(root: ParentNode): () => void {
  const el = root.querySelector<HTMLElement>('.mini-map');
  if (!el) return () => {};
  let map: import('leaflet').Map | undefined;
  let removed = false;
  Promise.all([import('./map'), import('leaflet')]).then(([{ createMap, pinIcon }, { default: L }]) => {
    if (removed) return;
    const pins = JSON.parse(el.dataset.pins!) as { name: string; lat: number; lng: number }[];
    map = createMap(el);
    for (const p of pins) L.marker([p.lat, p.lng], { icon: pinIcon(), title: p.name }).bindPopup(p.name).addTo(map);
    map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 });
  });
  return () => {
    removed = true;
    map?.remove();
  };
}
