import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapsSearchUrl } from '../lib/shared';
import { loadMarks } from './marks';

interface Pin {
  key: string;
  name: string;
  branch: string;
  address?: string;
  lat: number;
  lng: number;
  approx?: boolean;
  offer: string;
  value: number;
  url: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function createMap(el: HTMLElement) {
  const map = L.map(el, { scrollWheelZoom: false }).setView([23.9, 121], 7);
  // 深色模式用 CSS filter 反轉 OSM 圖磚（見 global.css .map-tiles）
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'map-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  return map;
}

export function pinIcon(status?: string) {
  return L.divIcon({ className: '', html: `<div class="pin ${status ?? ''}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] });
}

let map: L.Map | undefined;
let layer: L.LayerGroup | undefined;
let data: { pins: Pin[]; noPin: { key: string; name: string }[] } | undefined;
let fitted = false;

export function showPins(visible: Set<string>) {
  const el = document.getElementById('map')!;
  data ??= JSON.parse(document.getElementById('pins')!.textContent!);
  if (!map) {
    map = createMap(el);
    layer = L.layerGroup().addTo(map);
    const Locate = L.Control.extend({
      onAdd() {
        const b = L.DomUtil.create('button', 'leaflet-bar');
        b.type = 'button';
        b.textContent = '我的位置';
        b.style.cssText = 'background:var(--surface);color:var(--text);padding:6px 10px;cursor:pointer;font:inherit;font-size:13px;font-weight:600';
        L.DomEvent.on(b, 'click', (e) => {
          L.DomEvent.stop(e);
          map!.locate({ setView: true, maxZoom: 14 });
        });
        return b;
      },
    });
    new Locate({ position: 'topleft' }).addTo(map);
    map.on('locationfound', (e) => L.circleMarker(e.latlng, { radius: 7, color: '#2f6fd0', fillOpacity: 0.9 }).addTo(map!));
  }
  // 從 hidden 切換成可見後需要重新量尺寸
  requestAnimationFrame(() => map!.invalidateSize());
  const marks = loadMarks();
  layer!.clearLayers();
  const shown = data!.pins.filter((p) => visible.has(p.key));
  for (const p of shown) {
    const st = marks[p.key]?.status;
    L.marker([p.lat, p.lng], { icon: pinIcon(st), title: `${p.name} ${p.branch}` })
      .bindPopup(
        `<div class="pop"><b><a href="${p.url}">${esc(p.name)}</a></b> ${esc(p.branch)}<br>${esc(p.offer)} <span class="v">$${p.value}</span>` +
          (p.address ? `<br><small>${esc(p.address)}${p.approx ? '（位置為大略）' : ''}</small>` : '') +
          `<br><a href="${mapsSearchUrl(`${p.name} ${p.address ?? p.branch}`)}" target="_blank" rel="noopener">Google 地圖導航</a></div>`,
      )
      .addTo(layer!);
  }
  if (!fitted && shown.length) {
    map.fitBounds(L.latLngBounds(shown.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 13 });
    fitted = true;
  }
  const rest = data!.noPin.filter((p) => visible.has(p.key));
  document.getElementById('nopin-text')!.textContent = rest.length
    ? `另有 ${rest.length} 家是連鎖店或還沒有分店座標，點下方用 Google 地圖找你附近的分店：`
    : '';
  document.getElementById('nopin')!.innerHTML = rest
    .map((p) => `<a class="chip" href="${mapsSearchUrl(p.name)}" target="_blank" rel="noopener">${esc(p.name)}</a>`)
    .join('');
}
