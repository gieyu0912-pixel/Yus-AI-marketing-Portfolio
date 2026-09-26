const TOKEN_KEY = "nailpick_token";
const PHONE_KEY = "nailpick_phone";
const CITIES = ["全部地區", "台中市", "台北市", "新北市", "桃園市", "新竹市", "高雄市", "台南市"];
const STYLES = ["全部風格", "韓系", "日系", "法式", "美式", "手繪", "貓眼", "延長", "足部", "新娘", "簡約", "3D", "奶茶色"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const state = {
  view: "home",
  artistId: null,
  artists: [],
  artist: null,
  bookings: [],
  me: null,
  filters: { city: "全部地區", style: "全部風格", date: "", q: "" },
  booking: { serviceId: null, date: "", time: "" },
  portalTab: "bookings",
  loading: false,
  error: "",
};

function token() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token()) headers.Authorization = "Bearer " + token();
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const msg = Array.isArray(data?.detail)
      ? data.detail.map((d) => d.msg || d).join("、")
      : data?.detail || data?.message || "請求失敗";
    throw new Error(typeof msg === "string" ? msg : "請求失敗");
  }
  return data;
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function fmtMoney(n) {
  return "NT$ " + Number(n).toLocaleString("zh-TW");
}
function todayISO() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function addDaysISO(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const z = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function parseISO(iso) {
  return new Date(iso + "T00:00:00");
}
function workUrls(a) {
  if (!a) return [];
  if (a.workUrls && a.workUrls.length) return a.workUrls;
  if (a.works && a.works.length) return a.works.map((w) => (typeof w === "string" ? w : w.url));
  return a.cover ? [a.cover] : [];
}
function isTaken(date, time) {
  return (state.artist?.taken || []).some((t) => t.date === date && t.time === time);
}

async function navigate(view, extra = {}) {
  state.view = view;
  Object.assign(state, extra);
  if (view !== "profile") state.booking = { serviceId: null, date: "", time: "" };
  window.scrollTo({ top: 0, behavior: "instant" });
  await render();
}

async function loadArtists() {
  const p = new URLSearchParams();
  if (state.filters.city && state.filters.city !== "全部地區") p.set("city", state.filters.city);
  if (state.filters.style && state.filters.style !== "全部風格") p.set("style", state.filters.style);
  if (state.filters.q) p.set("q", state.filters.q);
  if (state.filters.date) p.set("date", state.filters.date);
  state.artists = await api("/api/artists?" + p.toString());
}

async function loadMe() {
  if (!token()) {
    state.me = null;
    return;
  }
  try {
    state.me = await api("/api/me");
  } catch {
    setToken(null);
    state.me = null;
  }
}

function renderNav() {
  const me = state.me;
  return `
    <header class="nav">
      <div class="container nav-inner">
        <div class="brand" onclick="navigate('home')">
          <div class="brand-mark">指</div>
          <div class="brand-name">指尖選 <span>NailPick</span></div>
        </div>
        <nav class="nav-links">
          <button class="linkish hide-sm" onclick="navigate('home')">首頁</button>
          <button class="linkish" onclick="navigate('browse')">找美甲師</button>
          <button class="linkish hide-sm" onclick="navigate('mybookings')">我的預約</button>
          ${
            me
              ? `<button class="btn btn-ghost" onclick="navigate('portal')">${me.name} 的工作室</button>
                 <button class="linkish" onclick="logout()">登出</button>`
              : `<button class="btn btn-ghost" onclick="navigate('portal')">美甲師入口</button>`
          }
          <button class="btn btn-rose" onclick="navigate('browse')">立即預約</button>
        </nav>
      </div>
    </header>`;
}

function renderFooter() {
  return `
    <footer>
      <div class="container footer-grid">
        <div>
          <div class="brand" style="margin-bottom:8px">
            <div class="brand-mark">指</div>
            <div class="brand-name">指尖選</div>
          </div>
          <p>雲端版：作品、檔期與預約存在伺服器，換裝置也能看到同一份資料。</p>
        </div>
        <div>
          <h4>客人</h4>
          <p><a href="#" onclick="navigate('browse');return false">瀏覽美甲師</a></p>
          <p><a href="#" onclick="navigate('mybookings');return false">查詢預約</a></p>
        </div>
        <div>
          <h4>美甲師</h4>
          <p><a href="#" onclick="navigate('portal');return false">上架工作室</a></p>
          <p>上傳作品・設定檔期</p>
        </div>
        <div>
          <h4>系統</h4>
          <p>REST API + SQLite<br>可部署至 Render / Railway / Docker</p>
        </div>
      </div>
      <div class="container" style="margin-top:24px;opacity:.7">© 2026 指尖選 NailPick ｜ 雲端版</div>
    </footer>
    <div id="toast" class="toast"></div>`;
}

function searchPanel() {
  return `
    <form class="search-panel" onsubmit="applySearch(event)">
      <div>
        <label>關鍵字</label>
        <input name="q" placeholder="美甲師、工作室、風格" value="${state.filters.q || ""}">
      </div>
      <div>
        <label>地區</label>
        <select name="city">${CITIES.map((c) => `<option ${c === state.filters.city ? "selected" : ""}>${c}</option>`).join("")}</select>
      </div>
      <div>
        <label>想做的日期</label>
        <input name="date" type="date" min="${todayISO()}" value="${state.filters.date || ""}">
      </div>
      <div style="display:flex;align-items:end">
        <button class="btn btn-primary" type="submit" style="width:100%">搜尋</button>
      </div>
    </form>`;
}

async function applySearch(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  state.filters.q = fd.get("q") || "";
  state.filters.city = fd.get("city");
  state.filters.date = fd.get("date") || "";
  await navigate("browse");
}

function artistCard(a) {
  const cover = a.cover || workUrls(a)[0] || "";
  return `
    <article class="artist-card" onclick="navigate('profile', {artistId:${a.id}})">
      <div class="artist-cover">
        <img src="${cover}" alt="${a.name} 作品">
        <div class="badge">${a.city}・${a.district || ""}</div>
      </div>
      <div class="artist-body">
        <div class="artist-top">
          <div>
            <h3>${a.name}</h3>
            <div class="meta">${a.studio} ｜ 資歷 ${a.years} 年</div>
          </div>
          <div class="stars">★ ${a.rating} <span style="color:var(--ink-soft);font-weight:400">(${a.reviews})</span></div>
        </div>
        <div class="tags">${(a.styles || []).map((s) => `<span class="tag">${s}</span>`).join("")}</div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">
          <span class="price">起價 ${fmtMoney(a.priceFrom)}</span>
          <span class="meta">查看檔期 →</span>
        </div>
      </div>
    </article>`;
}

function renderHome() {
  const featured = state.artists.slice(0, 3);
  const first = state.artists[0];
  return `
    <section class="container hero">
      <div>
        <div class="eyebrow">CLOUD NAIL MATCHING</div>
        <h1>看作品、選時段<br>預約命定美甲師</h1>
        <p class="lead">雲端媒合平台：作品與檔期即時同步。客人直接鎖定空檔，美甲師在後台管理預約與作品集。</p>
        <div class="hero-actions">
          <button class="btn btn-rose" onclick="navigate('browse')">尋找美甲師</button>
          <button class="btn btn-ghost" onclick="navigate('portal')">我是美甲師，我要上架</button>
        </div>
        <div class="hero-stats">
          <div><b>${state.artists.length}</b><span>位美甲師在線</span></div>
          <div><b>共用資料庫</b><span>換裝置資料仍在</span></div>
          <div><b>即時空檔</b><span>預約互鎖時段</span></div>
        </div>
      </div>
      <div class="hero-visual">
        <img src="https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=1400&h=1600&fit=crop" alt="美甲作品">
        ${
          first
            ? `<div class="float-card one">
          <img class="mini-av" src="${first.avatar}" alt="">
          <div><b style="font-size:13px">${first.name}</b><div style="font-size:12px;color:var(--ink-soft)">${first.city}・${first.studio}</div></div>
        </div>`
            : ""
        }
        <div class="float-card two">
          <div class="dot"></div>
          <div><b style="font-size:13px">雲端即時媒合</b><div style="font-size:12px;color:var(--ink-soft)">作品 + 日期 + 風格</div></div>
        </div>
      </div>
    </section>
    <div class="container">${searchPanel()}</div>
    <section class="container section">
      <div class="section-head"><div><div class="eyebrow">HOW IT WORKS</div><h2>三步完成預約</h2></div></div>
      <div class="steps">
        <div class="step"><div class="step-num">01</div><h3>看作品選人</h3><p>依城市、風格、預算瀏覽美甲師作品集。</p></div>
        <div class="step"><div class="step-num">02</div><h3>挑日期時段</h3><p>日曆只顯示可預約空檔，時段由伺服器鎖定。</p></div>
        <div class="step"><div class="step-num">03</div><h3>雲端確認</h3><p>預約寫入資料庫，美甲師後台立刻看到客人與備註。</p></div>
      </div>
    </section>
    <section class="container section">
      <div class="section-head">
        <div><div class="eyebrow">FEATURED</div><h2>推薦美甲師</h2></div>
        <button class="btn btn-ghost" onclick="navigate('browse')">看全部</button>
      </div>
      <div class="grid">${featured.map(artistCard).join("")}</div>
    </section>`;
}

function renderBrowse() {
  const list = state.artists;
  return `
    <section class="container section" style="padding-top:28px">
      <div class="section-head">
        <div>
          <div class="eyebrow">BROWSE</div>
          <h2>選擇你的美甲師</h2>
          <p>共 ${list.length} 位符合條件</p>
        </div>
      </div>
      ${searchPanel()}
      <div class="tags" style="margin:-36px 0 24px">
        ${STYLES.map(
          (s) =>
            `<button class="tag" style="cursor:pointer;border:0;${
              state.filters.style === s ? "background:var(--ink);color:#fff" : ""
            }" onclick="filterStyle('${s}')">${s}</button>`
        ).join("")}
      </div>
      ${list.length ? `<div class="grid">${list.map(artistCard).join("")}</div>` : `<div class="empty">目前沒有符合的美甲師。</div>`}
    </section>`;
}

async function filterStyle(s) {
  state.filters.style = s;
  await render();
}

function nextDates(n = 14) {
  return Array.from({ length: n }, (_, i) => addDaysISO(todayISO(), i));
}

function renderProfile() {
  const a = state.artist;
  if (!a) return `<div class="container empty">找不到這位美甲師</div>`;
  if (!state.booking.serviceId && a.services[0]) state.booking.serviceId = a.services[0].id;
  const svc = a.services.find((s) => s.id === state.booking.serviceId) || a.services[0];
  const dates = nextDates(12);
  const works = workUrls(a);
  return `
    <section class="container profile-wrap">
      <div>
        <button class="btn btn-ghost" onclick="navigate('browse')">← 返回列表</button>
        <div class="gallery" style="margin-top:16px">
          ${works.slice(0, 3).map((w) => `<img src="${w}" alt="作品">`).join("")}
        </div>
        <div style="display:flex;gap:14px;align-items:center;margin-top:20px">
          <img src="${a.avatar}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover">
          <div>
            <h1>${a.name}</h1>
            <div class="meta">${a.studio} ｜ ${a.city}${a.district || ""} ｜ 資歷 ${a.years} 年</div>
            <div class="stars">★ ${a.rating}　${a.reviews} 則評價</div>
          </div>
        </div>
        <p class="bio">${a.bio}</p>
        <div class="tags">${(a.styles || []).map((s) => `<span class="tag">${s}</span>`).join("")}</div>
        <h3 style="margin:28px 0 10px;font-family:var(--font-serif)">服務項目</h3>
        <div class="services">
          ${a.services
            .map(
              (s) => `
            <div class="service ${state.booking.serviceId === s.id ? "active" : ""}" onclick="pickService(${s.id})">
              <div><b>${s.name}</b><small>${s.mins} 分鐘</small></div>
              <div class="price">${fmtMoney(s.price)}</div>
            </div>`
            )
            .join("")}
        </div>
      </div>
      <aside class="book-box">
        <h3>預約 ${a.name}</h3>
        <div class="meta" style="margin-bottom:12px">${svc ? `已選：${svc.name} · ${fmtMoney(svc.price)}` : "請選擇服務"}</div>
        <div class="field"><label>選擇日期</label></div>
        <div class="dates">
          ${dates
            .map((d) => {
              const dt = parseISO(d);
              const off = (a.offDays || []).includes(dt.getDay());
              const active = state.booking.date === d;
              return `<button class="date-chip ${active ? "active" : ""} ${off ? "disabled" : ""}" onclick="pickDate('${d}')">
                <span>${WEEKDAYS[dt.getDay()]}</span><b>${dt.getDate()}</b>
              </button>`;
            })
            .join("")}
        </div>
        <div class="field" style="margin-top:8px"><label>選擇時段</label></div>
        <div class="times">
          ${
            state.booking.date
              ? (a.slots || [])
                  .map((t) => {
                    const taken = isTaken(state.booking.date, t);
                    const active = state.booking.time === t;
                    return `<button class="time-chip ${active ? "active" : ""} ${taken ? "disabled" : ""}" onclick="pickTime('${t}')">${t}${
                      taken ? " 滿" : ""
                    }</button>`;
                  })
                  .join("")
              : `<span class="meta">請先選擇日期</span>`
          }
        </div>
        <div class="field"><label>你的稱呼</label><input id="bk-name" placeholder="例如：小美"></div>
        <div class="field"><label>手機</label><input id="bk-phone" placeholder="0912345678" value="${localStorage.getItem(PHONE_KEY) || ""}"></div>
        <div class="field"><label>備註（可貼 IG 款式）</label><textarea id="bk-note" rows="2" placeholder="想做奶茶色、中長杏仁甲…"></textarea></div>
        <button class="btn btn-rose" style="width:100%" onclick="submitBooking()">確認預約 ${svc ? fmtMoney(svc.price) : ""}</button>
        <p class="meta" style="margin-top:10px;text-align:center">預約會寫入雲端資料庫，美甲師立刻看得到。</p>
      </aside>
    </section>`;
}

async function pickService(id) {
  state.booking.serviceId = id;
  await render();
}
async function pickDate(d) {
  state.booking.date = d;
  state.booking.time = "";
  await render();
}
async function pickTime(t) {
  state.booking.time = t;
  await render();
}

async function submitBooking() {
  const name = document.getElementById("bk-name").value.trim();
  const phone = document.getElementById("bk-phone").value.trim();
  const note = document.getElementById("bk-note").value.trim();
  if (!state.booking.date || !state.booking.time) return toast("請選擇日期與時段");
  try {
    await api("/api/bookings", {
      method: "POST",
      body: {
        artistId: state.artist.id,
        serviceId: state.booking.serviceId,
        date: state.booking.date,
        time: state.booking.time,
        clientName: name,
        phone,
        note,
      },
    });
    localStorage.setItem(PHONE_KEY, phone.replace(/\D/g, ""));
    toast("預約成功，已寫入雲端");
    await navigate("mybookings");
  } catch (err) {
    toast(err.message);
  }
}

function renderMyBookings() {
  const phone = localStorage.getItem(PHONE_KEY) || "";
  const list = state.bookings;
  return `
    <section class="container section" style="padding-top:32px">
      <div class="section-head"><div><div class="eyebrow">BOOKINGS</div><h2>我的預約</h2></div></div>
      <form class="search-panel" style="grid-template-columns:1fr auto;margin-bottom:24px" onsubmit="lookupBookings(event)">
        <div><label>用手機查詢（雲端資料）</label><input name="phone" value="${phone}" placeholder="0912345678"></div>
        <div style="display:flex;align-items:end"><button class="btn btn-primary" type="submit">查詢</button></div>
      </form>
      ${
        list.length === 0
          ? `<div class="empty">還沒有預約紀錄。<br><button class="btn btn-rose" style="margin-top:12px" onclick="navigate('browse')">去找美甲師</button></div>`
          : `<div class="panel"><table class="table">
              <thead><tr><th>日期時段</th><th>美甲師</th><th>服務</th><th>聯絡</th><th>狀態</th><th></th></tr></thead>
              <tbody>
                ${list
                  .map(
                    (b) => `<tr>
                    <td>${b.date}<br><b>${b.time}</b></td>
                    <td>${b.artistName}<br><span class="meta">${b.studio}</span></td>
                    <td>${b.service}<br>${fmtMoney(b.price)}</td>
                    <td>${b.clientName}<br>${b.phone}</td>
                    <td><span class="status">${b.status === "cancelled" ? "已取消" : "已確認"}</span></td>
                    <td>${
                      b.status === "cancelled"
                        ? ""
                        : `<button class="btn btn-ghost" onclick="cancelBooking(${b.id})">取消</button>`
                    }</td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table></div>`
      }
    </section>`;
}

async function lookupBookings(e) {
  e.preventDefault();
  const phone = new FormData(e.target).get("phone");
  localStorage.setItem(PHONE_KEY, String(phone).replace(/\D/g, ""));
  await render();
}

async function cancelBooking(id) {
  const phone = localStorage.getItem(PHONE_KEY);
  try {
    await api(`/api/bookings/${id}/cancel?phone=${encodeURIComponent(phone)}`, { method: "POST" });
    toast("已取消，時段已釋放");
    await render();
  } catch (err) {
    toast(err.message);
  }
}

async function logout() {
  setToken(null);
  state.me = null;
  toast("已登出");
  await navigate("home");
}

function renderAuth() {
  return `
    <div class="auth-card">
      <div class="eyebrow">ARTIST CLOUD</div>
      <h2>美甲師雲端入口</h2>
      <p class="meta">登入後資料存在伺服器，換電腦也能管理作品與預約。</p>
      <div class="hint">示範帳號：yuan@nailpick.tw　密碼：1234<br>也可使用 han / ching / muen / rina / cheng @nailpick.tw</div>
      <div class="field"><label>Email</label><input id="login-email" value="yuan@nailpick.tw"></div>
      <div class="field"><label>密碼</label><input id="login-pass" type="password" value="1234"></div>
      <button class="btn btn-rose" style="width:100%" onclick="doLogin()">登入工作室</button>
      <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
      <h3 style="font-family:var(--font-serif);margin-bottom:8px">還沒有帳號？立刻上架</h3>
      <div class="field"><label>姓名</label><input id="reg-name" placeholder="你的名字"></div>
      <div class="field"><label>工作室名稱</label><input id="reg-studio" placeholder="例如：小花美甲"></div>
      <div class="field"><label>城市</label>
        <select id="reg-city">${CITIES.filter((c) => c !== "全部地區").map((c) => `<option>${c}</option>`).join("")}</select>
      </div>
      <div class="field"><label>行政區</label><input id="reg-dist" placeholder="西區"></div>
      <div class="field"><label>Email</label><input id="reg-email" placeholder="you@mail.com"></div>
      <div class="field"><label>密碼</label><input id="reg-pass" type="password" placeholder="至少 4 碼"></div>
      <button class="btn btn-primary" style="width:100%" onclick="doRegister()">建立並上架到雲端</button>
    </div>`;
}

async function doLogin() {
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-pass").value,
      },
    });
    setToken(data.token);
    state.me = data.artist;
    state.portalTab = "bookings";
    toast("歡迎回來，" + data.artist.name);
    await navigate("portal");
  } catch (err) {
    toast(err.message);
  }
}

async function doRegister() {
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: {
        name: document.getElementById("reg-name").value,
        studio: document.getElementById("reg-studio").value,
        city: document.getElementById("reg-city").value,
        district: document.getElementById("reg-dist").value,
        email: document.getElementById("reg-email").value,
        password: document.getElementById("reg-pass").value,
      },
    });
    setToken(data.token);
    state.me = data.artist;
    state.portalTab = "works";
    toast("已上架到雲端，接著上傳作品");
    await navigate("portal");
  } catch (err) {
    toast(err.message);
  }
}

function renderPortal() {
  const me = state.me;
  if (!me) return renderAuth();
  const tabs = {
    bookings: "預約管理",
    works: "作品集",
    services: "服務項目",
    schedule: "可預約時段",
    profile: "工作室資料",
  };
  return `
    <section class="container portal-grid">
      <aside class="side">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
          <img src="${me.avatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover" alt="">
          <div><b>${me.name}</b><div class="meta">${me.studio}</div></div>
        </div>
        ${Object.entries(tabs)
          .map(
            ([k, v]) =>
              `<button class="${state.portalTab === k ? "active" : ""}" onclick="setTab('${k}')">${v}</button>`
          )
          .join("")}
      </aside>
      <div>${renderPortalTab(me)}</div>
    </section>`;
}

async function setTab(k) {
  state.portalTab = k;
  await render();
}

function renderPortalTab(me) {
  if (state.portalTab === "bookings") {
    const mine = state.bookings;
    return `<div class="panel">
      <h2 style="font-family:var(--font-serif);margin-bottom:6px">預約管理</h2>
      <p class="meta" style="margin-bottom:16px">雲端共 ${mine.length} 筆</p>
      ${
        mine.length === 0
          ? `<div class="empty">尚無預約</div>`
          : `<table class="table"><thead><tr><th>時間</th><th>客人</th><th>服務</th><th>備註</th><th>狀態</th></tr></thead><tbody>
            ${mine
              .map(
                (b) => `<tr>
                <td>${b.date} ${b.time}</td>
                <td>${b.clientName}<br>${b.phone}</td>
                <td>${b.service}<br>${fmtMoney(b.price)}</td>
                <td>${b.note || "—"}</td>
                <td><span class="status">${b.status === "cancelled" ? "已取消" : "已確認"}</span></td>
              </tr>`
              )
              .join("")}
          </tbody></table>`
      }
    </div>`;
  }
  if (state.portalTab === "works") {
    return `<div class="panel">
      <h2 style="font-family:var(--font-serif);margin-bottom:6px">作品集</h2>
      <p class="meta" style="margin-bottom:16px">上傳後存到雲端，所有客人立刻看得到。</p>
      <label class="upload-box">
        <input type="file" accept="image/*" hidden onchange="uploadWork(event)">
        <b>點擊上傳作品照片</b>
        <div class="meta">JPG / PNG / WEBP，最大 8MB</div>
      </label>
      <div class="works-grid" style="margin-top:16px">
        ${
          (me.works || []).length
            ? me.works
                .map(
                  (w) =>
                    `<div class="work-item"><img src="${w.url}" alt=""><button onclick="removeWork(${w.id})">×</button></div>`
                )
                .join("")
            : `<div class="empty" style="grid-column:1/-1">還沒有作品</div>`
        }
      </div>
    </div>`;
  }
  if (state.portalTab === "services") {
    return `<div class="panel">
      <h2 style="font-family:var(--font-serif);margin-bottom:12px">服務項目</h2>
      <div class="services">
        ${(me.services || [])
          .map(
            (s) => `<div class="service">
            <div><b>${s.name}</b><small>${s.mins} 分鐘</small></div>
            <div style="display:flex;gap:8px;align-items:center">
              <span class="price">${fmtMoney(s.price)}</span>
              <button class="btn btn-ghost" onclick="removeService(${s.id})">刪除</button>
            </div>
          </div>`
          )
          .join("")}
      </div>
      <h3 style="margin:22px 0 10px">新增服務</h3>
      <div class="search-panel" style="grid-template-columns:2fr 1fr 1fr auto;margin:0;box-shadow:none">
        <div><label>名稱</label><input id="ns-name" placeholder="例如：貓眼設計"></div>
        <div><label>分鐘</label><input id="ns-mins" type="number" value="90"></div>
        <div><label>價格</label><input id="ns-price" type="number" value="1280"></div>
        <div style="display:flex;align-items:end"><button class="btn btn-primary" onclick="addService()">新增</button></div>
      </div>
    </div>`;
  }
  if (state.portalTab === "schedule") {
    return `<div class="panel">
      <h2 style="font-family:var(--font-serif);margin-bottom:8px">可預約時段</h2>
      <p class="meta" style="margin-bottom:16px">公休與鐘點會同步到客人端日曆。</p>
      <div class="week-grid">
        ${WEEKDAYS.map((w, i) => {
          const off = (me.offDays || []).includes(i);
          return `<div class="week-day">
            <h4>週${w}</h4>
            <label><input type="checkbox" ${off ? "checked" : ""} onchange="toggleOff(${i}, this.checked)"> 公休</label>
          </div>`;
        }).join("")}
      </div>
      <div class="field" style="margin-top:18px">
        <label>每日開放時段</label>
        <input id="slot-input" value="${(me.slots || []).join(", ")}">
      </div>
      <button class="btn btn-rose" onclick="saveSlots()">儲存到雲端</button>
    </div>`;
  }
  return `<div class="panel">
    <h2 style="font-family:var(--font-serif);margin-bottom:12px">工作室資料</h2>
    <div class="field"><label>姓名</label><input id="pf-name" value="${me.name}"></div>
    <div class="field"><label>工作室</label><input id="pf-studio" value="${me.studio}"></div>
    <div class="field"><label>城市</label><input id="pf-city" value="${me.city}"></div>
    <div class="field"><label>地區</label><input id="pf-dist" value="${me.district || ""}"></div>
    <div class="field"><label>風格標籤（逗號分隔）</label><input id="pf-styles" value="${(me.styles || []).join(", ")}"></div>
    <div class="field"><label>介紹</label><textarea id="pf-bio" rows="4">${me.bio || ""}</textarea></div>
    <button class="btn btn-rose" onclick="saveProfile()">儲存到雲端</button>
  </div>`;
}

async function uploadWork(e) {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  try {
    await api("/api/me/works", { method: "POST", body: fd });
    toast("作品已上傳到雲端");
    await render();
  } catch (err) {
    toast(err.message);
  }
}
async function removeWork(id) {
  try {
    await api("/api/me/works/" + id, { method: "DELETE" });
    await render();
  } catch (err) {
    toast(err.message);
  }
}
async function addService() {
  try {
    await api("/api/me/services", {
      method: "POST",
      body: {
        name: document.getElementById("ns-name").value,
        mins: Number(document.getElementById("ns-mins").value),
        price: Number(document.getElementById("ns-price").value),
      },
    });
    toast("已新增服務");
    await render();
  } catch (err) {
    toast(err.message);
  }
}
async function removeService(id) {
  try {
    await api("/api/me/services/" + id, { method: "DELETE" });
    await render();
  } catch (err) {
    toast(err.message);
  }
}
async function toggleOff(day, checked) {
  const off = new Set(state.me.offDays || []);
  if (checked) off.add(day);
  else off.delete(day);
  try {
    await api("/api/me/schedule", { method: "PUT", body: { offDays: [...off], slots: state.me.slots || [] } });
    toast("已更新公休日");
    await render();
  } catch (err) {
    toast(err.message);
  }
}
async function saveSlots() {
  const slots = document
    .getElementById("slot-input")
    .value.split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    await api("/api/me/schedule", { method: "PUT", body: { offDays: state.me.offDays || [], slots } });
    toast("時段已同步");
    await render();
  } catch (err) {
    toast(err.message);
  }
}
async function saveProfile() {
  try {
    const artist = await api("/api/me", {
      method: "PUT",
      body: {
        name: document.getElementById("pf-name").value,
        studio: document.getElementById("pf-studio").value,
        city: document.getElementById("pf-city").value,
        district: document.getElementById("pf-dist").value,
        styles: document.getElementById("pf-styles").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        bio: document.getElementById("pf-bio").value,
      },
    });
    state.me = artist;
    toast("資料已更新");
    await render();
  } catch (err) {
    toast(err.message);
  }
}

async function render() {
  const root = document.getElementById("app");
  state.loading = true;
  root.innerHTML =
    renderNav() +
    `<main class="page"><div class="container" style="padding:48px 0;color:var(--ink-soft)">載入雲端資料中…</div></main>` +
    renderFooter();
  try {
    await loadMe();
    if (state.view === "home" || state.view === "browse") await loadArtists();
    if (state.view === "profile") state.artist = await api("/api/artists/" + state.artistId);
    if (state.view === "mybookings") {
      const phone = localStorage.getItem(PHONE_KEY);
      state.bookings = phone ? await api("/api/bookings?phone=" + encodeURIComponent(phone)) : [];
    }
    if (state.view === "portal" && state.me) {
      if (state.portalTab === "bookings") state.bookings = await api("/api/me/bookings");
      else state.me = await api("/api/me");
    }
    state.error = "";
  } catch (err) {
    state.error = err.message;
  }
  state.loading = false;
  let body = "";
  if (state.error && !["home", "browse", "profile", "mybookings", "portal"].includes(state.view)) {
    body = `<div class="container empty">${state.error}</div>`;
  } else if (state.view === "home") body = renderHome();
  else if (state.view === "browse") body = renderBrowse();
  else if (state.view === "profile") body = renderProfile();
  else if (state.view === "mybookings") body = renderMyBookings();
  else if (state.view === "portal") body = renderPortal();
  if (state.error && state.view !== "mybookings") {
    body = `<div class="container empty">${state.error}</div>` + body;
  }
  root.innerHTML = renderNav() + `<main class="page">${body}</main>` + renderFooter();
}

document.addEventListener("DOMContentLoaded", () => render());
