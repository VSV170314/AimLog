const TOKEN_KEY = "aimlog-token-v2";

const I = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M17 4h2a2 2 0 012 2v1a4 4 0 01-4 4h-1M7 4H5a2 2 0 00-2 2v1a4 4 0 004 4h1"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5M4 19h16"/><path d="M8 16V9M12 16v-5M16 16V7"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>',
};

let user = null;
let view = "dashboard";
let detailId = null;
let editMode = false;
let authMode = "login";
let authError = null;
let authBusy = false;
let form = null;
let toastTimer = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function fmt(n, d = 1) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toFixed(d);
}
function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch("/api" + path, { ...opts, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/auth/")) {
    setToken(null);
    user = null;
  }
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
}

function go(v, id = null, edit = false) {
  view = v;
  detailId = id;
  editMode = edit;
  form = null;
  if (v === "practice-new") {
    form = { date: today(), equipment: "", distance: "", notes: "", shots: [], shotInput: "", error: null, saving: false };
  }
  if (v === "competition-new") {
    form = {
      name: "",
      date: today(),
      totalShots: "40",
      totalScore: "",
      rank: "",
      coachComments: "",
      equipment: "",
      distance: "",
      error: null,
      saving: false,
    };
  }
  render();
}

function brandHtml() {
  return `<div class="brand-mark">${I.target}</div>
    <div><div class="brand-text">AIMLOG</div><div class="brand-sub">Track · Improve · Perform</div></div>`;
}

function renderNav() {
  const app = document.getElementById("app");
  const side = document.getElementById("sidebar");
  const bottom = document.getElementById("bottom-nav");
  const topbar = document.getElementById("topbar");

  if (!user) {
    app.classList.add("logged-out");
    side.innerHTML = "";
    bottom.innerHTML = "";
    topbar.innerHTML = "";
    return;
  }
  app.classList.remove("logged-out");

  const items = [
    { id: "dashboard", label: "Dashboard", icon: I.dash },
    { id: "practice-new", label: "New Practice", icon: I.plus, group: "Practice" },
    { id: "practice-history", label: "Practice History", icon: I.list, group: "Practice" },
    { id: "competition-new", label: "New Competition", icon: I.trophy, group: "Competitions" },
    { id: "competition-history", label: "Competition History", icon: I.list, group: "Competitions" },
    { id: "statistics", label: "Statistics", icon: I.chart },
    { id: "profile", label: "Profile", icon: I.user },
  ];

  const active = view.startsWith("practice-detail")
    ? "practice-history"
    : view.startsWith("competition-detail")
      ? "competition-history"
      : view;

  let html = `<a href="#" class="brand" data-go="dashboard">${brandHtml()}</a>`;
  let lastGroup = null;
  for (const it of items) {
    if (it.group && it.group !== lastGroup) {
      html += `<div class="nav-label">${it.group}</div>`;
      lastGroup = it.group;
    }
    if (!it.group) lastGroup = null;
    html += `<button type="button" class="nav-item ${active === it.id ? "active" : ""}" data-go="${it.id}">${it.icon}${it.label}</button>`;
  }
  html += `<div class="sidebar-footer">${esc(user.name)}<br/><span style="color:var(--text-dim)">${esc(user.email)}</span></div>`;
  side.innerHTML = html;

  const mobile = [
    { id: "dashboard", label: "Home", icon: I.dash },
    { id: "practice-new", label: "Practice", icon: I.plus },
    { id: "competition-new", label: "Match", icon: I.trophy },
    { id: "statistics", label: "Stats", icon: I.chart },
    { id: "profile", label: "Profile", icon: I.user },
  ];
  bottom.innerHTML = mobile
    .map(
      (it) =>
        `<button type="button" class="nav-item ${active === it.id ? "active" : ""}" data-go="${it.id}">${it.icon}${it.label}</button>`
    )
    .join("");

  topbar.innerHTML = `<a href="#" class="brand" data-go="dashboard">${brandHtml()}</a>`;

  document.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      go(el.dataset.go);
    };
  });
}

function chartSvg(points) {
  if (!points || points.length < 2) {
    return `<div class="chart-empty">Not enough data yet for a trend chart.</div>`;
  }
  const w = 400,
    h = 150,
    pad = 16;
  const vals = points.map((p) => p.avg);
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 10.9);
  const span = max - min || 1;
  const pts = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.avg - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = line + ` L${pts[pts.length - 1].x},${h - pad} L${pts[0].x},${h - pad} Z`;
  return `<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35"/><stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#cg)"/><path d="${line}" fill="none" stroke="#22d3ee" stroke-width="2"/>
  </svg></div>`;
}

function renderAuth() {
  const isReg = authMode === "register";
  return `<div class="auth-screen"><div class="auth-card">
    <div class="brand">${brandHtml()}</div>
    <h1>${isReg ? "Create account" : "Welcome back"}</h1>
    <p class="lead">${isReg ? "Start tracking practice and competition performance." : "Sign in to your performance log."}</p>
    <form class="auth-form" id="auth-form">
      ${isReg ? `<div class="form-field"><label for="name">Name</label><input id="name" type="text" required minlength="2" autocomplete="name" placeholder="Alex Rivera"/></div>` : ""}
      <div class="form-field"><label for="email">Email</label><input id="email" type="email" required autocomplete="email" placeholder="you@email.com"/></div>
      <div class="form-field"><label for="password">Password</label><input id="password" type="password" required minlength="6" autocomplete="${isReg ? "new-password" : "current-password"}" placeholder="••••••••"/></div>
      ${authError ? `<p class="error">${esc(authError)}</p>` : ""}
      <button type="submit" class="btn btn-primary btn-lg" ${authBusy ? "disabled" : ""}>${authBusy ? "Please wait…" : isReg ? "Create account" : "Sign in"}</button>
    </form>
    <p class="auth-switch">${isReg ? "Already have an account?" : "New to AimLog?"}
      <button type="button" id="switch-auth">${isReg ? "Sign in" : "Create account"}</button></p>
  </div></div>`;
}

function renderDashboard(d) {
  return `
  <div class="page-head" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;align-items:flex-end">
    <div>
      <p class="page-eyebrow">Overview</p>
      <h1 class="page-title">Dashboard</h1>
      <p class="page-desc">Your shooting performance at a glance.</p>
    </div>
    <div class="btn-row">
      <button type="button" class="btn" data-go="practice-new">${I.plus} New Practice</button>
      <button type="button" class="btn btn-primary" data-go="competition-new">${I.trophy} New Competition</button>
    </div>
  </div>
  <section class="stat-grid" style="margin-bottom:1.5rem">
    <div class="card"><p class="stat-label">Total Practices</p><p class="stat-value">${d.totalPractices}</p></div>
    <div class="card"><p class="stat-label">Total Competitions</p><p class="stat-value">${d.totalCompetitions}</p></div>
    <div class="card"><p class="stat-label">Average Score</p><p class="stat-value accent">${d.averageScore != null ? fmt(d.averageScore, 2) : "—"}</p><p class="stat-hint">practice avg / shot</p></div>
    <div class="card"><p class="stat-label">Best Score</p><p class="stat-value accent">${d.bestScore != null ? fmt(d.bestScore) : "—"}</p><p class="stat-hint">highest total</p></div>
  </section>
  <div class="card" style="margin-bottom:1.5rem">
    <div class="section-head"><h2>Performance trend</h2></div>
    ${chartSvg(d.trend)}
  </div>
  <section>
    <div class="section-head"><h2>Recent activity</h2></div>
    ${
      !d.recent.length
        ? `<div class="card empty"><h3>No activity yet</h3><p>Start your first practice session and begin tracking your progress.</p>
           <button type="button" class="btn btn-primary" data-go="practice-new">${I.plus} New Practice</button></div>`
        : `<ul class="list">${d.recent
            .map(
              (r) => `<li><button type="button" class="list-item" data-open="${r.type}:${r.id}">
              <div><div class="list-item-title">${esc(r.title)} <span class="badge ${r.type === "competition" ? "badge-match" : "badge-practice"}">${r.type}</span></div>
              <div class="list-item-meta">${fmtDate(r.date)} · ${r.shots} shots${r.rank ? ` · Rank #${r.rank}` : ""}</div></div>
              <div class="list-item-score">${fmt(r.score)} <small>/ ${fmt(r.maxScore)} · avg ${fmt(r.average, 2)}</small></div>
            </button></li>`
            )
            .join("")}</ul>`
    }
  </section>`;
}

function renderPracticeForm(editData) {
  if (!form) return "";
  const shots = form.shots;
  const total = shots.reduce((a, b) => a + b, 0);
  const max = shots.length * 10;
  const avg = shots.length ? total / shots.length : 0;

  return `
  <div class="page-head">
    <p class="page-eyebrow">Practice</p>
    <h1 class="page-title">${editData ? "Edit practice" : "New practice"}</h1>
    <p class="page-desc">Log individual shots from 0 to 10.9. Totals and averages update automatically.</p>
  </div>
  <form class="form" id="prac-form" style="max-width:560px">
    <div class="form-grid">
      <div class="form-field"><label for="date">Date</label><input id="date" type="date" value="${esc(form.date)}" required/></div>
      <div class="form-field"><label for="equipment">Equipment</label><input id="equipment" type="text" value="${esc(form.equipment)}" placeholder="Air rifle / pistol"/></div>
      <div class="form-field"><label for="distance">Distance</label><input id="distance" type="text" value="${esc(form.distance)}" placeholder="10m"/></div>
      <div class="form-field span-2"><label for="notes">Notes</label><textarea id="notes" placeholder="Hold, trigger, lighting…">${esc(form.notes)}</textarea></div>
    </div>
    <div class="shot-pad">
      <div class="shot-stats">
        <div class="shot-stat"><div class="lbl">Shots</div><div class="val">${shots.length}</div></div>
        <div class="shot-stat"><div class="lbl">Total</div><div class="val">${fmt(total)}</div></div>
        <div class="shot-stat"><div class="lbl">Max</div><div class="val">${fmt(max)}</div></div>
        <div class="shot-stat"><div class="lbl">Average</div><div class="val">${shots.length ? fmt(avg, 2) : "—"}</div></div>
      </div>
      <div class="shot-list">
        ${
          shots.length === 0
            ? `<span style="color:var(--text-dim);font-size:0.875rem">No shots yet — enter a score below.</span>`
            : shots
                .map((s, i) => {
                  const cls = s >= 10.5 ? "ten" : s >= 9 ? "high" : "";
                  return `<span class="shot-chip ${cls}"><span style="color:var(--text-dim);font-size:0.7rem">${i + 1}.</span>${fmt(s)}
                    <button type="button" data-rm="${i}" title="Remove">×</button></span>`;
                })
                .join("")
        }
      </div>
      <div class="shot-entry">
        <input id="shotInput" type="number" min="0" max="10.9" step="0.1" inputmode="decimal" placeholder="0 – 10.9" value="${esc(form.shotInput)}"/>
        <button type="button" class="btn btn-primary" id="add-shot">Add shot</button>
      </div>
    </div>
    ${form.error ? `<p class="error">${esc(form.error)}</p>` : ""}
    <div class="btn-row" style="justify-content:flex-end">
      ${editData ? `<button type="button" class="btn" data-open="practice:${editData.id}">Cancel</button>` : ""}
      <button type="submit" class="btn btn-primary btn-lg" ${form.saving ? "disabled" : ""}>${form.saving ? "Saving…" : editData ? "Update practice" : "Save practice"}</button>
    </div>
  </form>`;
}

function renderPracticeHistory(list) {
  return `
  <div class="page-head" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;align-items:flex-end">
    <div>
      <p class="page-eyebrow">Practice</p>
      <h1 class="page-title">Practice history</h1>
      <p class="page-desc">${list.length} session${list.length === 1 ? "" : "s"}</p>
    </div>
    <button type="button" class="btn btn-primary" data-go="practice-new">${I.plus} New Practice</button>
  </div>
  ${
    !list.length
      ? `<div class="card empty"><h3>No practice sessions yet.</h3><p>Start your first practice session and begin tracking your progress.</p>
         <button type="button" class="btn btn-primary" data-go="practice-new">${I.plus} New Practice</button></div>`
      : `<ul class="list">${list
          .map(
            (p) => `<li><button type="button" class="list-item" data-open="practice:${p.id}">
            <div><div class="list-item-title">Practice Session</div>
            <div class="list-item-meta">${fmtDate(p.date)} · ${p.totalShots} Shots</div></div>
            <div class="list-item-score">${fmt(p.totalScore)} / ${fmt(p.maxScore)}
              <small>Average: ${fmt(p.average, 2)}</small></div>
          </button></li>`
          )
          .join("")}</ul>`
  }`;
}

function renderPracticeDetail(p) {
  if (!p) return `<p class="error">Practice not found.</p><button type="button" class="btn" data-go="practice-history">Back</button>`;
  return `
  <div class="page-head">
    <button type="button" class="link-btn" data-go="practice-history" style="margin-bottom:0.5rem">← Practice history</button>
    <p class="page-eyebrow">Practice details</p>
    <h1 class="page-title">Practice Session</h1>
  </div>
  <div class="card">
    <dl class="detail-grid">
      <div><dt>Date</dt><dd>${fmtDate(p.date)}</dd></div>
      <div><dt>Shots</dt><dd>${p.totalShots}</dd></div>
      <div><dt>Score</dt><dd>${fmt(p.totalScore)} / ${fmt(p.maxScore)}</dd></div>
      <div><dt>Average</dt><dd>${fmt(p.average, 2)}</dd></div>
      ${p.equipment ? `<div><dt>Equipment</dt><dd style="font-family:var(--font);font-size:1rem">${esc(p.equipment)}</dd></div>` : ""}
      ${p.distance ? `<div><dt>Distance</dt><dd style="font-family:var(--font);font-size:1rem">${esc(p.distance)}</dd></div>` : ""}
    </dl>
    ${p.notes ? `<p style="margin-top:1rem;color:var(--text-muted)">${esc(p.notes)}</p>` : ""}
    <p class="stat-label" style="margin-top:1.25rem">Individual shots</p>
    <div class="shot-detail-list">
      ${p.shots.map((s, i) => `<div class="shot-detail-item"><div class="n">#${i + 1}</div>${fmt(s)}</div>`).join("")}
    </div>
    <div class="btn-row" style="margin-top:1.5rem">
      <button type="button" class="btn" id="edit-practice">Edit</button>
      <button type="button" class="btn btn-danger" id="del-practice">Delete</button>
    </div>
  </div>`;
}

function renderCompForm(editData) {
  if (!form) return "";
  const shots = Number(form.totalShots) || 0;
  const score = Number(form.totalScore);
  const max = shots * 10;
  const avg = shots && Number.isFinite(score) ? score / shots : null;
  return `
  <div class="page-head">
    <p class="page-eyebrow">Competition</p>
    <h1 class="page-title">${editData ? "Edit competition" : "New competition"}</h1>
    <p class="page-desc">Record match results, rank, and coach feedback. Final score only — no individual shots.</p>
  </div>
  <form class="form" id="comp-form">
    <div class="form-grid">
      <div class="form-field span-2"><label for="name">Competition name</label><input id="name" type="text" value="${esc(form.name)}" required placeholder="State Championship"/></div>
      <div class="form-field"><label for="date">Date</label><input id="date" type="date" value="${esc(form.date)}" required/></div>
      <div class="form-field"><label for="rank">Rank</label><input id="rank" type="number" min="1" value="${esc(form.rank)}" placeholder="#"/></div>
      <div class="form-field"><label for="totalShots">Number of shots</label><input id="totalShots" type="number" min="1" value="${esc(form.totalShots)}" required/></div>
      <div class="form-field"><label for="totalScore">Total score</label><input id="totalScore" type="number" min="0" step="0.1" value="${esc(form.totalScore)}" required placeholder="356.4"/></div>
      <div class="form-field"><label>Maximum</label><input type="text" value="${shots ? fmt(max) : "—"}" disabled/></div>
      <div class="form-field"><label>Average</label><input type="text" value="${avg != null ? fmt(avg, 2) : "—"}" disabled/></div>
      <div class="form-field"><label for="equipment">Equipment</label><input id="equipment" type="text" value="${esc(form.equipment)}" placeholder="Optional"/></div>
      <div class="form-field"><label for="distance">Distance</label><input id="distance" type="text" value="${esc(form.distance)}" placeholder="Optional"/></div>
      <div class="form-field span-2"><label for="coachComments">Coach's comments</label><textarea id="coachComments" placeholder="Work on consistency and follow-through.">${esc(form.coachComments)}</textarea></div>
    </div>
    ${form.error ? `<p class="error">${esc(form.error)}</p>` : ""}
    <div class="btn-row" style="justify-content:flex-end">
      ${editData ? `<button type="button" class="btn" data-open="competition:${editData.id}">Cancel</button>` : ""}
      <button type="submit" class="btn btn-primary btn-lg" ${form.saving ? "disabled" : ""}>${form.saving ? "Saving…" : editData ? "Update competition" : "Save competition"}</button>
    </div>
  </form>`;
}

function renderCompHistory(list) {
  return `
  <div class="page-head" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:1rem;align-items:flex-end">
    <div>
      <p class="page-eyebrow">Competitions</p>
      <h1 class="page-title">Competition history</h1>
      <p class="page-desc">${list.length} match${list.length === 1 ? "" : "es"}</p>
    </div>
    <button type="button" class="btn btn-primary" data-go="competition-new">${I.trophy} New Competition</button>
  </div>
  ${
    !list.length
      ? `<div class="card empty"><h3>No competitions yet.</h3><p>Log your first match result to build your competition record.</p>
         <button type="button" class="btn btn-primary" data-go="competition-new">${I.trophy} New Competition</button></div>`
      : `<ul class="list">${list
          .map(
            (c) => `<li><button type="button" class="list-item" data-open="competition:${c.id}">
            <div><div class="list-item-title">${esc(c.name)}</div>
            <div class="list-item-meta">${fmtDate(c.date)} · ${c.totalShots} Shots${c.rank ? ` · Rank #${c.rank}` : ""}</div></div>
            <div class="list-item-score">${fmt(c.totalScore)} / ${fmt(c.maxScore)}
              <small>Average: ${fmt(c.average, 2)}</small></div>
          </button></li>`
          )
          .join("")}</ul>`
  }`;
}

function renderCompDetail(c) {
  if (!c) return `<p class="error">Competition not found.</p><button type="button" class="btn" data-go="competition-history">Back</button>`;
  return `
  <div class="page-head">
    <button type="button" class="link-btn" data-go="competition-history" style="margin-bottom:0.5rem">← Competition history</button>
    <p class="page-eyebrow">Competition details</p>
    <h1 class="page-title">${esc(c.name)}</h1>
  </div>
  <div class="card">
    <dl class="detail-grid">
      <div><dt>Date</dt><dd>${fmtDate(c.date)}</dd></div>
      <div><dt>Shots</dt><dd>${c.totalShots}</dd></div>
      <div><dt>Score</dt><dd>${fmt(c.totalScore)} / ${fmt(c.maxScore)}</dd></div>
      <div><dt>Average</dt><dd>${fmt(c.average, 2)}</dd></div>
      ${c.rank != null ? `<div><dt>Rank</dt><dd>#${c.rank}</dd></div>` : ""}
      ${c.equipment ? `<div><dt>Equipment</dt><dd style="font-family:var(--font);font-size:1rem">${esc(c.equipment)}</dd></div>` : ""}
      ${c.distance ? `<div><dt>Distance</dt><dd style="font-family:var(--font);font-size:1rem">${esc(c.distance)}</dd></div>` : ""}
    </dl>
    ${
      c.coachComments
        ? `<div class="coach-box"><div class="stat-label" style="margin-bottom:0.35rem">Coach's comments</div>${esc(c.coachComments)}</div>`
        : ""
    }
    <div class="btn-row" style="margin-top:1.5rem">
      <button type="button" class="btn" id="edit-comp">Edit</button>
      <button type="button" class="btn btn-danger" id="del-comp">Delete</button>
    </div>
  </div>`;
}

function renderStats(s) {
  return `
  <div class="page-head">
    <p class="page-eyebrow">Analytics</p>
    <h1 class="page-title">Statistics</h1>
    <p class="page-desc">Deep dive into your practice and competition numbers.</p>
  </div>
  <section class="stat-grid" style="margin-bottom:1.5rem">
    <div class="card"><p class="stat-label">Total practices</p><p class="stat-value">${s.totalPractices}</p></div>
    <div class="card"><p class="stat-label">Total competitions</p><p class="stat-value">${s.totalCompetitions}</p></div>
    <div class="card"><p class="stat-label">Total shots</p><p class="stat-value">${s.totalShots}</p></div>
    <div class="card"><p class="stat-label">Best rank</p><p class="stat-value accent">${s.bestRank != null ? "#" + s.bestRank : "—"}</p></div>
    <div class="card"><p class="stat-label">Avg practice</p><p class="stat-value accent">${s.averagePracticeScore != null ? fmt(s.averagePracticeScore, 2) : "—"}</p></div>
    <div class="card"><p class="stat-label">Avg competition</p><p class="stat-value accent">${s.averageCompetitionScore != null ? fmt(s.averageCompetitionScore, 2) : "—"}</p></div>
    <div class="card"><p class="stat-label">Highest score</p><p class="stat-value">${s.highestScore != null ? fmt(s.highestScore) : "—"}</p></div>
    <div class="card"><p class="stat-label">Best average</p><p class="stat-value">${s.bestAverage != null ? fmt(s.bestAverage, 2) : "—"}</p></div>
  </section>
  <div class="card" style="margin-bottom:1rem">
    <div class="section-head"><h2>Practice averages over time</h2></div>
    ${chartSvg(s.practiceTrend)}
  </div>
  <div class="card">
    <div class="section-head"><h2>Competition averages over time</h2></div>
    ${chartSvg(s.compTrend)}
  </div>`;
}

function renderProfile() {
  return `
  <div class="page-head">
    <p class="page-eyebrow">Account</p>
    <h1 class="page-title">Profile</h1>
  </div>
  <div class="card" style="max-width:28rem">
    <p class="stat-label">Name</p>
    <p style="font-size:1.15rem;font-weight:600;margin:0.25rem 0 1rem">${esc(user.name)}</p>
    <p class="stat-label">Email</p>
    <p style="margin:0.25rem 0 1rem;color:var(--text-muted)">${esc(user.email)}</p>
    <p class="stat-label">Member since</p>
    <p style="margin:0.25rem 0 1.25rem;color:var(--text-muted)">${fmtDate(user.createdAt?.slice(0, 10))}</p>
    <form id="profile-form" class="form" style="margin-bottom:1rem">
      <div class="form-field"><label for="pname">Display name</label><input id="pname" type="text" value="${esc(user.name)}" minlength="2" required/></div>
      <button type="submit" class="btn">Save name</button>
    </form>
    <button type="button" class="btn btn-danger" id="logout-btn">Log out</button>
  </div>`;
}

function wireOpeners(root) {
  root.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      go(el.dataset.go);
    };
  });
  root.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = () => {
      const [type, id] = el.dataset.open.split(":");
      if (type === "practice") go("practice-detail", id);
      else go("competition-detail", id);
    };
  });
}

async function render() {
  renderNav();
  const content = document.getElementById("content");

  if (!user) {
    content.innerHTML = renderAuth();
    document.getElementById("switch-auth").onclick = () => {
      authMode = authMode === "login" ? "register" : "login";
      authError = null;
      render();
    };
    document.getElementById("auth-form").onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("name")?.value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      authError = null;
      authBusy = true;
      render();
      try {
        const path = authMode === "register" ? "/auth/register" : "/auth/login";
        const body = authMode === "register" ? { name, email, password } : { email, password };
        const res = await api(path, { method: "POST", body: JSON.stringify(body) });
        setToken(res.token);
        user = res.user;
        authBusy = false;
        go("dashboard");
        toast(authMode === "register" ? "✓ Account created" : "✓ Signed in");
      } catch (err) {
        authBusy = false;
        authError = err.message;
        render();
      }
    };
    return;
  }

  try {
    if (view === "dashboard") {
      content.innerHTML = `<p class="loading">Loading…</p>`;
      const d = await api("/dashboard");
      content.innerHTML = renderDashboard(d);
      wireOpeners(content);
    } else if (view === "practice-new" || (view === "practice-detail" && editMode)) {
      let editData = null;
      if (editMode && detailId) {
        editData = await api("/practices/" + detailId);
        if (!form) {
          form = {
            date: editData.date,
            equipment: editData.equipment || "",
            distance: editData.distance || "",
            notes: editData.notes || "",
            shots: [...editData.shots],
            shotInput: "",
            error: null,
            saving: false,
          };
        }
      }
      content.innerHTML = renderPracticeForm(editData);
      wireOpeners(content);
      wirePracticeForm(editData);
    } else if (view === "practice-history") {
      content.innerHTML = `<p class="loading">Loading…</p>`;
      const list = await api("/practices");
      content.innerHTML = renderPracticeHistory(list);
      wireOpeners(content);
    } else if (view === "practice-detail") {
      content.innerHTML = `<p class="loading">Loading…</p>`;
      const p = await api("/practices/" + detailId);
      content.innerHTML = renderPracticeDetail(p);
      wireOpeners(content);
      document.getElementById("edit-practice").onclick = () => go("practice-detail", detailId, true);
      document.getElementById("del-practice").onclick = async () => {
        if (!confirm("Are you sure you want to delete this practice session?")) return;
        await api("/practices/" + detailId, { method: "DELETE" });
        toast("Practice deleted successfully");
        go("practice-history");
      };
    } else if (view === "competition-new" || (view === "competition-detail" && editMode)) {
      let editData = null;
      if (editMode && detailId) {
        editData = await api("/competitions/" + detailId);
        if (!form) {
          form = {
            name: editData.name,
            date: editData.date,
            totalShots: String(editData.totalShots),
            totalScore: String(editData.totalScore),
            rank: editData.rank != null ? String(editData.rank) : "",
            coachComments: editData.coachComments || "",
            equipment: editData.equipment || "",
            distance: editData.distance || "",
            error: null,
            saving: false,
          };
        }
      }
      content.innerHTML = renderCompForm(editData);
      wireOpeners(content);
      wireCompForm(editData);
    } else if (view === "competition-history") {
      content.innerHTML = `<p class="loading">Loading…</p>`;
      const list = await api("/competitions");
      content.innerHTML = renderCompHistory(list);
      wireOpeners(content);
    } else if (view === "competition-detail") {
      content.innerHTML = `<p class="loading">Loading…</p>`;
      const c = await api("/competitions/" + detailId);
      content.innerHTML = renderCompDetail(c);
      wireOpeners(content);
      document.getElementById("edit-comp").onclick = () => go("competition-detail", detailId, true);
      document.getElementById("del-comp").onclick = async () => {
        if (!confirm("Are you sure you want to delete this competition?")) return;
        await api("/competitions/" + detailId, { method: "DELETE" });
        toast("Competition deleted successfully");
        go("competition-history");
      };
    } else if (view === "statistics") {
      content.innerHTML = `<p class="loading">Loading…</p>`;
      const s = await api("/statistics");
      content.innerHTML = renderStats(s);
      wireOpeners(content);
    } else if (view === "profile") {
      content.innerHTML = renderProfile();
      wireOpeners(content);
      document.getElementById("logout-btn").onclick = async () => {
        try {
          await api("/auth/logout", { method: "POST" });
        } catch (_) {}
        setToken(null);
        user = null;
        render();
      };
      document.getElementById("profile-form").onsubmit = async (e) => {
        e.preventDefault();
        try {
          const res = await api("/profile", {
            method: "PUT",
            body: JSON.stringify({ name: document.getElementById("pname").value }),
          });
          user = res.user;
          toast("✓ Profile updated");
          render();
        } catch (err) {
          toast(err.message);
        }
      };
    }
  } catch (err) {
    if (!getToken()) {
      user = null;
      content.innerHTML = renderAuth();
      return render();
    }
    content.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

function wirePracticeForm(editData) {
  const syncFields = () => {
    form.date = document.getElementById("date").value;
    form.equipment = document.getElementById("equipment").value;
    form.distance = document.getElementById("distance").value;
    form.notes = document.getElementById("notes").value;
    form.shotInput = document.getElementById("shotInput")?.value || "";
  };

  const addShot = () => {
    syncFields();
    const raw = form.shotInput.trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) {
      form.error = "Enter a valid shot score";
      render();
      return;
    }
    if (n < 0 || n > 10.9) {
      form.error = "Shot score must be between 0 and 10.9";
      render();
      return;
    }
    form.shots.push(Math.round(n * 10) / 10);
    form.shotInput = "";
    form.error = null;
    render();
  };

  document.getElementById("add-shot").onclick = addShot;
  document.getElementById("shotInput").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addShot();
    }
  };
  document.getElementById("content").querySelectorAll("[data-rm]").forEach((btn) => {
    btn.onclick = () => {
      form.shots.splice(Number(btn.dataset.rm), 1);
      form.error = null;
      render();
    };
  });

  document.getElementById("prac-form").onsubmit = async (e) => {
    e.preventDefault();
    syncFields();
    if (!form.shots.length) {
      form.error = "Add at least one shot";
      render();
      return;
    }
    form.saving = true;
    render();
    try {
      const body = {
        date: form.date,
        equipment: form.equipment,
        distance: form.distance,
        notes: form.notes,
        shots: form.shots,
      };
      let saved;
      if (editData) {
        saved = await api("/practices/" + editData.id, { method: "PUT", body: JSON.stringify(body) });
        toast("✓ Practice updated successfully");
      } else {
        saved = await api("/practices", { method: "POST", body: JSON.stringify(body) });
        toast("✓ Practice saved successfully");
      }
      go("practice-detail", saved.id);
    } catch (err) {
      form.saving = false;
      form.error = err.message;
      render();
    }
  };
}

function wireCompForm(editData) {
  const fields = ["name", "date", "rank", "totalShots", "totalScore", "equipment", "distance", "coachComments"];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.oninput = () => {
      form[id] = el.value;
      if (id === "totalShots" || id === "totalScore") render();
    };
  });

  document.getElementById("comp-form").onsubmit = async (e) => {
    e.preventDefault();
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) form[id] = el.value;
    });
    form.saving = true;
    form.error = null;
    render();
    try {
      const body = {
        name: form.name,
        date: form.date,
        totalShots: Number(form.totalShots),
        totalScore: Number(form.totalScore),
        rank: form.rank,
        coachComments: form.coachComments,
        equipment: form.equipment,
        distance: form.distance,
      };
      let saved;
      if (editData) {
        saved = await api("/competitions/" + editData.id, { method: "PUT", body: JSON.stringify(body) });
        toast("✓ Competition updated successfully");
      } else {
        saved = await api("/competitions", { method: "POST", body: JSON.stringify(body) });
        toast("✓ Competition saved successfully");
      }
      go("competition-detail", saved.id);
    } catch (err) {
      form.saving = false;
      form.error = err.message;
      render();
    }
  };
}

async function boot() {
  if (getToken()) {
    try {
      const res = await api("/auth/me");
      user = res.user;
    } catch {
      setToken(null);
    }
  }
  render();
}

boot();
