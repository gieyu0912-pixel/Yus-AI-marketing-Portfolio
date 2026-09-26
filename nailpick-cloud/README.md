# 指尖選 NailPick｜雲端版

美甲師與客人媒合預約平台。前端 + FastAPI + SQLite，一份程式即可部署到 Render、Railway 或自己的 Docker 主機。

## 和本機原型的差別

| | 本機原型 | 雲端版 |
|---|---|---|
| 資料 | 瀏覽器 localStorage | 伺服器 SQLite |
| 圖片 | 僅當機有效 | 上傳到 `/uploads` 永久保存 |
| 預約衝突 | 單人瀏覽器 | 全員共用、時段互鎖 |
| 登入 | 假 session | JWT |
| 上線 | 不行 | Docker / Render / Railway |

## 本機啟動

```bash
cd nailpick-cloud
python3 -m pip install -r requirements.txt
chmod +x start.sh
./start.sh
```

瀏覽器開 http://127.0.0.1:8090  
健康檢查：http://127.0.0.1:8090/api/health

示範美甲師帳號（密碼皆 `1234`）：

- yuan@nailpick.tw（台中）
- han@nailpick.tw（台北）
- ching@nailpick.tw（台中）
- muen@nailpick.tw（新竹）
- rina@nailpick.tw（高雄）
- cheng@nailpick.tw（台南）

## 用 Docker 啟動

```bash
docker compose up --build
```

資料寫入 named volume `nailpick-data`，重啟不會掉。

## 部署到 Render（建議，約 5 分鐘）

1. 把這個資料夾推上 GitHub
2. 到 [Render](https://render.com) → New → Blueprint
3. 選擇 repo，會讀取 `render.yaml`
4. 加上一塊 Disk（yaml 已寫 `/data`）
5. 環境變數 `JWT_SECRET` 請換成長隨機字串
6. 部署完成後網址即為正式站，例如 `https://nailpick.onrender.com`

免費／入門方案休眠後第一次開啟會較慢，屬正常。

## 部署到 Railway

1. New Project → Deploy from GitHub
2. Root Directory 指向本資料夾
3. 設定環境變數：
   - `JWT_SECRET`
   - `PORT`（Railway 會自動給，不必填死）
4. Volume 掛載到 `/data`
5. Start command：`mkdir -p /data/uploads && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## API 一覽

- `GET /api/health`
- `GET /api/artists`
- `GET /api/artists/{id}`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET|PUT /api/me`
- `POST /api/me/works`（multipart 圖片）
- `DELETE /api/me/works/{id}`
- `POST /api/me/services`
- `PUT /api/me/schedule`
- `POST /api/bookings`
- `GET /api/bookings?phone=`
- `GET /api/me/bookings`
- `POST /api/bookings/{id}/cancel?phone=`

## 上線前必做

1. 更換 `JWT_SECRET`
2. 提醒示範帳號僅供展示，正式營運請刪除或改密
3. 需要網域時，在 Render / Railway 綁定自訂網域並開 HTTPS
4. 流量變大時，把 `DATABASE_URL` 換成 PostgreSQL（SQLAlchemy 已相容）
