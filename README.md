# 靈魂藍圖 SPA - 線上預約系統

## 部署到 Vercel
1. 用 GitHub 帳號登入 vercel.com，選 Import Project，選這個 repo（Linda）。
2. 在 Vercel 專案的 Settings -> Environment Variables 新增兩組：
   - `GITHUB_TOKEN`：一組有 Contents 讀寫權限的 GitHub Token（跟這個 repo 同一個帳號底下）
   - `ADMIN_TOKEN`：後台登入密碼，自己設一組即可
3. 存檔後按 Deploy，等部署完成會拿到一個 https://xxx.vercel.app 的網址。
4. 之後每次 git push 到 main，Vercel 會自動重新部署。

## 資料存放位置
- `data/bookings/YYYY-MM.json`：每個月一份預約資料，第一次有人在那個月預約時會自動建立。
- `data/customers.json`：所有客戶資料（含儲值餘額、剩餘堂數、來店紀錄）。

## 行事曆訂閱
後台「行事曆訂閱」分頁會給一組網址，格式是：
`https://你的網域/api/calendar?key=你的ADMIN_TOKEN`
把這組網址貼到 Google 日曆「透過網址新增」即可訂閱，Google 端更新有延遲（幾小時到近一天），非即時。
