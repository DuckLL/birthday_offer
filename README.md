# DuckLL 的壽星優惠攻略

壽星生日優惠一覽：<https://hbd.duckll.tw>

- 餐廳 / 商店列表，可搜尋、依地區、類型、平台、期限篩選；桌機版表頭可點欄位排序、漏斗按鈕篩選，欄位可拖曳排序、開關、拖表頭右緣調整寬度（存在 localStorage）
- 地圖檢視（有分店座標的店家），連鎖店提供 Google 地圖找附近分店
- 點店家用 modal 顯示詳細資訊（優惠、領取平台說明、介紹、分店），網址同步成 `/r/<名稱>/`，可直接分享
- 每筆資料有更新日期，超過一年會顯示「可能過期」（在瀏覽器依當天日期判斷，不用重新 build）
- 「想吃 / 吃過 / 預計日期 / 筆記」存在瀏覽器 localStorage，可匯出 JSON / CSV / .ics、匯入 JSON

Astro 7 靜態網站，資料全部在 `src/data/*.yaml`。

## 開發

```sh
nvm use          # Node 24（.nvmrc）
npm install
npm run dev      # http://localhost:4321
```

`npm run dev` 時多一個 **資料編輯器**：<http://localhost:4321/edit>

- 左邊選店家、右邊改欄位，按「儲存到 YAML」寫回 `src/data/*.yaml`，網站自動更新
- 分店填地址後按「定位」會用 OpenStreetMap 查座標
- 存檔時，內容有改動的店家 `updated` 會自動設為今天（手動改過日期則保留你填的）
- 如果編輯期間檔案被別人（或 agent）改過，存檔會被拒絕，重新整理後再改
- 編輯器只存在於 dev，`npm run build` 不會產生 `/edit`

改完後 `git commit` + `git push`，Cloudflare Pages 會自動部署。

## 部署（Cloudflare Pages）

| 設定 | 值 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node 版本 | 讀 `.nvmrc`（24） |

## 資料格式

每個檔案是一個 map，**key 就是店家名稱**（也是網址 `/r/<名稱>/`），不可重複；重複時 build 會失敗並指出行號。

### `src/data/restaurants.yaml`

```yaml
泰滾:
  category: 火鍋            # 必填，類型
  platform: Ocard           # 選填，領取平台，必須是 platforms.yaml 的 key
  offer: 幾歲送幾隻蝦        # 必填，優惠內容
  value: 500                # 必填，約略價值（數字）
  period: 當天              # 選填，使用期限；省略代表生日當月
  notes: 提前預約、低消2000  # 選填，備註；含「免消費」會出現在免消費篩選
  intro: 泰式火鍋…          # 選填，店家介紹
  caution: 活動可能已結束…   # 選填，警示（列表會顯示驚嘆號）
  regions: [台北市, 桃園市]  # 選填，縣市；全國連鎖用 [全台]
  website: https://…        # 選填，官網
  sources:                  # 選填，資料來源網址
    - https://…
  locations:                # 選填，分店；有 lat/lng 才會出現在地圖
    - name: 南西店
      address: 台北市中山區南京西路5-1號B1
      lat: 25.05256
      lng: 121.52138
      approx: true          # 座標只定位到路段時標記
  updated: 2026-10-26       # 必填，這筆資料最後更新／確認的日期；超過一年網站提示可能過期
  verified: false           # intro 以後的欄位是否已人工確認
```

### `src/data/shops.yaml`

和餐廳相同，但優惠欄位是：

```yaml
Uniqlo:
  category: 服飾
  minSpend: 1000   # 低消；沒有低消就省略（= 可 100% 折抵）
  discount: 100    # 折抵金額
```

實付比例由網站計算：`(minSpend - discount) / minSpend`。

### `src/data/platforms.yaml`

```yaml
Ocard:
  intro: 平台說明，顯示在店家頁的「領取方式」
  url: https://ocard.co   # 選填，官網
  ios: https://apps.apple.com/tw/app/id978302973                     # 選填，App Store
  android: https://play.google.com/store/apps/details?id=com.ocard  # 選填，Google Play
```

### 地區名稱

只能用 `src/lib/shared.ts` 的 `REGION_GROUPS` 裡的縣市（用「台」不用「臺」），另外有 `全台`、`線上`。打錯 build 會失敗。

## 給 agent 的注意事項

- 直接改 YAML 即可，保持既有格式：店家之間空一行、`regions` 用 `[a, b]`、欄位順序同上。不要動檔案開頭的註解。
- 改了哪家店的資料（或確認過仍然正確），就把那家的 `updated` 改成當天日期。
- 新增 `platform` 前先在 `platforms.yaml` 加說明，否則 build 會失敗。
- 平台名稱用 APP 在 App Store / Google Play 上的正式名稱（例如 `王品瘋美食`、`PK雙饗卡`），`ios` / `android` 放 App Store 與 Google Play 連結。
- 補分店座標可以在 dev server 開著時呼叫 `GET /__edit/api/geocode?q=<地址>`。
- 改完跑 `npm run build` 確認通過。

## 授權

- 程式碼：[MIT License](LICENSE)，© DuckLL
- 優惠資料（`src/data/*.yaml`）：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hant)，轉載或再利用請註明出處「DuckLL 的壽星優惠攻略 <https://hbd.duckll.tw>」
