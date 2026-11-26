// ============================================================
// MODE DEMO: tiruan Supabase yang menyimpan data di browser
// (localStorage). Dipakai otomatis selama config.js belum diisi,
// supaya admin & website bisa dicoba sebelum Supabase siap.
// Data di sini TIDAK online dan tidak pindah ke Supabase.
// ============================================================
import { DEMO } from "./demo.js";

const KEY = "portfolio-demo-v1";
const SESSION_KEY = "portfolio-demo-session";
const now = () => new Date().toISOString();
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function seed() {
  return {
    profile: [{ id: 1, ...DEMO.profile }],
    projects: DEMO.projects.map((p, i) => ({ sort: i, created_at: now(), ...p })),
    cv_items: DEMO.cv.map((c, i) => ({ id: "c" + (i + 1), sort: i, created_at: now(), ...c })),
  };
}

let store;
try { store = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { store = seed(); }
const persist = () => localStorage.setItem(KEY, JSON.stringify(store));

export function resetDemo() { localStorage.removeItem(KEY); }

const cmp = (a, b) => (a == null ? -1 : b == null ? 1 : a < b ? -1 : a > b ? 1 : 0);

function query(table) {
  let op = "select", vals = null, single = false;
  const filters = [], orders = [];
  const match = r => filters.every(([k, v]) => String(r[k]) === String(v));

  function run() {
    const rows = store[table];
    if (!rows) return { data: null, error: { message: `relation "${table}" does not exist` } };
    let data;
    if (op === "select") {
      data = rows.filter(match);
      for (const [k, asc] of [...orders].reverse()) data = [...data].sort((a, b) => cmp(a[k], b[k]) * (asc ? 1 : -1));
    } else if (op === "insert") {
      data = (Array.isArray(vals) ? vals : [vals]).map(v => ({ id: newId(), created_at: now(), sort: 0, ...v }));
      rows.push(...data);
    } else if (op === "update") {
      data = rows.filter(match);
      data.forEach(r => Object.assign(r, vals));
    } else if (op === "upsert") {
      let r = rows.find(x => String(x.id) === String(vals.id));
      if (r) Object.assign(r, vals); else rows.push((r = { ...vals }));
      data = [r];
    } else {
      data = rows.filter(match);
      store[table] = rows.filter(r => !match(r));
    }
    if (op !== "select") {
      try { persist(); } catch {
        return { data: null, error: { message: "Penyimpanan browser penuh. Di mode demo pakai gambar yang kecil saja." } };
      }
    }
    return { data: clone(single ? data[0] ?? null : data), error: null };
  }

  const b = {
    select() { return b; },
    eq(k, v) { filters.push([k, v]); return b; },
    order(k, o = {}) { orders.push([k, o.ascending !== false]); return b; },
    insert(v) { op = "insert"; vals = v; return b; },
    update(v) { op = "update"; vals = v; return b; },
    upsert(v) { op = "upsert"; vals = v; return b; },
    delete() { op = "delete"; return b; },
    maybeSingle() { single = true; return b; },
    then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
  };
  return b;
}

const uploads = {};
const readAsDataUrl = file => new Promise((ok, no) => {
  const fr = new FileReader();
  fr.onload = () => ok(fr.result);
  fr.onerror = () => no(fr.error);
  fr.readAsDataURL(file);
});

export const client = {
  from: query,
  // Di mode demo, siapa pun yang login dianggap admin.
  async rpc(name) {
    if (name !== "is_admin") return { data: null, error: { message: "rpc tidak dikenal" } };
    return { data: !!sessionStorage.getItem(SESSION_KEY), error: null };
  },
  storage: {
    from() {
      return {
        async upload(path, file) {
          if (file.size > 1.5 * 1024 * 1024) return { error: { message: "Di mode demo, ukuran file maksimal 1,5 MB." } };
          uploads[path] = await readAsDataUrl(file);
          return { error: null };
        },
        getPublicUrl(path) { return { data: { publicUrl: uploads[path] } }; },
      };
    },
  },
  auth: {
    async getSession() {
      const s = sessionStorage.getItem(SESSION_KEY);
      return { data: { session: s ? JSON.parse(s) : null } };
    },
    async signInWithPassword({ email }) {
      const session = { user: { email: email || "demo" } };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { data: { session }, error: null };
    },
    async signOut() { sessionStorage.removeItem(SESSION_KEY); return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  },
};
