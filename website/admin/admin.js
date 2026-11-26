import { getClient, isConfigured, CV_TYPES, BUCKET, h, slugify, projectUrl } from "../db.js";

const root = document.getElementById("admin");
const sb = await getClient();

// ---------- Definisi form ----------
const FIELDS = {
  profile: [
    { k: "name", label: "Nama", req: true },
    { k: "headline", label: "Kalimat utama", type: "textarea", rows: 2, hint: "Kalimat besar di paling atas website, mis. “Saya membangun produk digital yang sederhana dan bermanfaat.”" },
    { k: "location", label: "Lokasi" },
    { k: "email", label: "Email publik", type: "email" },
    { k: "bio", label: "Bio", type: "textarea", rows: 6, hint: "Pisahkan paragraf dengan satu baris kosong." },
    { k: "skills", label: "Skill", type: "tags", hint: "Pisahkan dengan koma." },
    { k: "links", label: "Link", type: "links", hint: "Satu per baris → Label | URL   (mis. GitHub | https://github.com/username)" },
    { k: "cv_url", label: "File CV (PDF)", type: "file", accept: "application/pdf", folder: "cv", hint: "Muncul sebagai tombol “Download CV”." },
  ],
  projects: [
    { k: "title", label: "Judul", req: true },
    { k: "slug", label: "Alamat halaman", type: "slug", hint: "Kosongkan untuk dibuat otomatis dari judul. Hanya huruf kecil, angka, dan tanda -." },
    { k: "subtitle", label: "Subjudul singkat", hint: "Muncul di bawah judul kartu, mis. Aplikasi kasir untuk UMKM." },
    { k: "year", label: "Tahun" },
    { k: "description", label: "Deskripsi", type: "textarea", rows: 6, hint: "Teks pembuka di halaman project. Pisahkan paragraf dengan baris kosong." },
    { k: "url", label: "Link project", type: "url", hint: "Opsional. Muncul sebagai “Buka project ↗” di halaman detail." },
    { k: "tags", label: "Kategori / tag", type: "tags", hint: "Pisahkan dengan koma. Dipakai juga sebagai filter di halaman utama (mis. hunian, interior)." },
    { k: "image_url", label: "Foto cover (thumbnail kartu)", type: "file", accept: "image/*", folder: "projects", hint: "Tampil di kartu halaman utama. Di halaman project, cover hanya muncul kalau belum ada blok konten." },
    { k: "sort", label: "Urutan", type: "number", hint: "Angka kecil tampil di atas." },
    { k: "blocks", label: "Konten halaman project", type: "blocks" },
  ],
  cv_items: [
    { k: "type", label: "Bagian", type: "select", options: CV_TYPES },
    { k: "title", label: "Posisi / jurusan / nama sertifikat", req: true },
    { k: "org", label: "Perusahaan / instansi" },
    { k: "period", label: "Periode", hint: "Mis. 2024 — Sekarang" },
    { k: "description", label: "Deskripsi", type: "textarea" },
    { k: "sort", label: "Urutan", type: "number", hint: "Angka kecil tampil di atas." },
  ],
};

const SUMMARY = {
  projects: r => [r.year, (r.tags || []).join(", "), r.slug ? "/project/" + r.slug : null,
    Array.isArray(r.blocks) && r.blocks.length ? `${r.blocks.length} blok konten` : null],
  cv_items: r => [CV_TYPES.find(([k]) => k === r.type)?.[1], r.org, r.period],
};

// ---------- Helper ----------
async function upload(file, folder) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function errBox(error) {
  const msg = error.message || String(error);
  const hint = /relation|does not exist|schema cache/i.test(msg)
    ? " Sepertinya supabase-setup.sql belum dijalankan."
    : "";
  return h("div", { class: "notice" }, "Error: " + msg + hint);
}

// Supabase tidak error kalau RLS menolak update/delete, hanya 0 baris berubah.
function mustChange(data) {
  if (!data || !data.length) throw new Error("Tidak diizinkan. Pastikan email login sama dengan email admin di supabase-setup.sql.");
}

function parse(f, raw) {
  if (f.type === "tags") return raw.split(",").map(s => s.trim()).filter(Boolean);
  if (f.type === "links") {
    return raw.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf("|");
      return i < 0 ? { label: l, url: l } : { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
    });
  }
  if (f.type === "number") return parseInt(raw, 10) || 0;
  return raw.trim();
}

function field(f, v) {
  if (f.type === "blocks") return blockEditor(f, v);
  let input;
  const extra = [];

  if (f.type === "slug") {
    input = h("input", { type: "text", placeholder: "otomatis dari judul", spellcheck: "false" });
    input.value = v ?? "";
    const show = h("small", { class: "slug-preview" });
    const upd = () => { show.textContent = "mikhellonkwa.site/project/" + (slugify(input.value) || "…"); };
    input.addEventListener("input", upd);
    upd();
    return {
      node: h("label", { class: "field" }, h("span", {}, f.label), input, show, h("small", {}, f.hint)),
      get: () => slugify(input.value),
    };
  }

  if (f.type === "textarea") {
    input = h("textarea", { rows: f.rows || 4 });
    input.value = v ?? "";
  } else if (f.type === "select") {
    input = h("select", {}, f.options.map(([val, label]) => h("option", { value: val }, label)));
    input.value = v ?? f.options[0][0];
  } else if (f.type === "tags") {
    input = h("input", { type: "text" });
    input.value = (v || []).join(", ");
  } else if (f.type === "links") {
    input = h("textarea", { rows: 4, placeholder: "GitHub | https://github.com/username" });
    input.value = (v || []).map(l => `${l.label} | ${l.url}`).join("\n");
  } else if (f.type === "number") {
    input = h("input", { type: "number", step: 1 });
    input.value = v ?? 0;
  } else if (f.type === "file") {
    input = h("input", { type: "url", placeholder: "Upload file di bawah, atau tempel URL" });
    input.value = v ?? "";
    const preview = h("div", { class: "preview" });
    const status = h("span", { class: "status" });
    const showPreview = () => {
      const u = input.value.trim();
      preview.replaceChildren(
        !u ? "" : f.accept.startsWith("image")
          ? h("img", { src: u, alt: "" })
          : h("a", { href: u, target: "_blank", rel: "noopener" }, "Lihat file ↗"));
    };
    const fileIn = h("input", {
      type: "file", accept: f.accept,
      onchange: async () => {
        const file = fileIn.files[0];
        if (!file) return;
        status.textContent = "Mengupload…";
        try {
          input.value = await upload(file, f.folder);
          status.textContent = "Terupload ✓ (jangan lupa klik Simpan)";
          showPreview();
        } catch (e) {
          status.textContent = "Gagal upload: " + e.message;
        }
      },
    });
    input.addEventListener("input", showPreview);
    showPreview();
    extra.push(fileIn, status, preview);
  } else {
    input = h("input", { type: f.type || "text" });
    input.value = v ?? "";
  }
  if (f.req) input.required = true;

  return {
    node: h("label", { class: "field" }, h("span", {}, f.label), input, extra, f.hint ? h("small", {}, f.hint) : null),
    get: () => parse(f, input.value),
  };
}

// ---------- Editor blok konten (halaman project) ----------
const BLOCK_TYPES = {
  text: { label: "Teks", make: () => ({ type: "text", text: "", size: "small" }) },
  image: { label: "Foto", make: () => ({ type: "image", url: "", caption: "", size: "normal" }) },
  gallery: { label: "Galeri", make: () => ({ type: "gallery", images: [], columns: 2, size: "normal" }) },
  slider: { label: "Slider", make: () => ({ type: "slider", images: [], size: "normal" }) },
  beforeafter: { label: "Before / After", make: () => ({ type: "beforeafter", before: "", after: "", beforeLabel: "Sebelum", afterLabel: "Sesudah", caption: "", size: "normal" }) },
  video: { label: "Video", make: () => ({ type: "video", url: "", caption: "", autoplay: false, size: "normal" }) },
};
const SIZES = [["small", "Lebar: kecil"], ["normal", "Lebar: sedang"], ["full", "Lebar: penuh"]];
const clone = v => JSON.parse(JSON.stringify(v ?? null));

const iconBtn = (text, label, onclick, disabled) =>
  h("button", { type: "button", class: "btn ghost sm icon", "aria-label": label, title: label, onclick, disabled: !!disabled }, text);

// Kolom berlabel (div, karena bisa berisi lebih dari satu input).
const group = (label, ...kids) => h("div", { class: "field" }, h("span", {}, label), kids);

function bindText(obj, key, { area = false, rows = 4, placeholder = "", label = "" } = {}) {
  const el = area ? h("textarea", { rows, placeholder, "aria-label": label }) : h("input", { type: "text", placeholder, "aria-label": label });
  el.value = obj[key] ?? "";
  el.addEventListener("input", () => { obj[key] = el.value; });
  return el;
}

// Satu file (foto / video): upload atau tempel URL.
function mediaInput(obj, key, { accept = "image/*", label = "Foto", hint = "" } = {}) {
  const url = h("input", { type: "url", placeholder: "Upload file, atau tempel URL", "aria-label": label });
  url.value = obj[key] || "";
  const preview = h("div", { class: "preview" });
  const status = h("span", { class: "status" });
  const show = () => {
    const u = url.value.trim();
    obj[key] = u;
    const isEmbed = /youtu\.?be|vimeo\.com/.test(u);
    preview.replaceChildren(!u ? "" : accept.startsWith("image") ? h("img", { src: u, alt: "" })
      : !isEmbed ? h("video", { src: u, controls: true, preload: "metadata" })
      : h("a", { href: u, target: "_blank", rel: "noopener" }, "Lihat video ↗"));
  };
  const file = h("input", {
    type: "file", accept, "aria-label": "Pilih file " + label,
    onchange: async () => {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 50 * 1024 * 1024) { status.textContent = "File lebih dari 50 MB. Kecilkan dulu, atau upload ke YouTube lalu tempel link-nya."; file.value = ""; return; }
      status.textContent = "Mengupload…";
      try {
        url.value = await upload(f, accept.startsWith("video") ? "videos" : "projects");
        status.textContent = "Terupload ✓";
        show();
      } catch (e) { status.textContent = "Gagal upload: " + e.message; }
      file.value = "";
    },
  });
  url.addEventListener("input", show);
  show();
  return group(label, url, file, status, preview, hint ? h("small", {}, hint) : null);
}

// Banyak foto (galeri / slider): upload sekaligus, atur urutan, kasih keterangan.
function imagesInput(obj) {
  obj.images = Array.isArray(obj.images) ? obj.images : [];
  const list = h("div", { class: "img-list" });
  const status = h("span", { class: "status" });
  const swap = (i, j) => { [obj.images[i], obj.images[j]] = [obj.images[j], obj.images[i]]; draw(); };
  const draw = () => list.replaceChildren(...obj.images.map((im, i) => {
    const cap = h("input", { type: "text", placeholder: "Keterangan (opsional)", "aria-label": `Keterangan foto ${i + 1}` });
    cap.value = im.caption || "";
    cap.addEventListener("input", () => { im.caption = cap.value; });
    return h("div", { class: "img-item" },
      h("img", { src: im.url, alt: `Foto ${i + 1}` }),
      cap,
      h("div", { class: "img-tools" },
        iconBtn("←", "Geser ke kiri", () => swap(i, i - 1), i === 0),
        iconBtn("→", "Geser ke kanan", () => swap(i, i + 1), i === obj.images.length - 1),
        iconBtn("✕", "Hapus foto ini", () => { obj.images.splice(i, 1); draw(); })));
  }));
  const file = h("input", {
    type: "file", accept: "image/*", multiple: true, "aria-label": "Pilih foto (bisa banyak)",
    onchange: async () => {
      const files = [...file.files];
      for (const [n, f] of files.entries()) {
        status.textContent = `Mengupload ${n + 1} dari ${files.length}…`;
        try { obj.images.push({ url: await upload(f, "projects"), caption: "" }); draw(); }
        catch (e) { status.textContent = "Gagal upload: " + e.message; file.value = ""; return; }
      }
      status.textContent = `${files.length} foto terupload ✓`;
      file.value = "";
    },
  });
  draw();
  return group("Foto (bisa pilih banyak sekaligus)", file, status, list);
}

function blockBody(b) {
  switch (b.type) {
    case "text":
      return group("Teks", bindText(b, "text", { area: true, rows: 6, label: "Teks", placeholder: "Pisahkan paragraf dengan baris kosong" }));
    case "image":
      return h("div", { class: "blk-body" }, mediaInput(b, "url", { label: "Foto" }), group("Keterangan", bindText(b, "caption", { label: "Keterangan" })));
    case "gallery": {
      const cols = h("select", { "aria-label": "Jumlah kolom" }, [1, 2, 3].map(n => h("option", { value: String(n) }, `${n} kolom`)));
      cols.value = String(b.columns || 2);
      cols.addEventListener("change", () => { b.columns = +cols.value; });
      return h("div", { class: "blk-body" }, group("Susunan", cols), imagesInput(b));
    }
    case "slider":
      return h("div", { class: "blk-body" }, imagesInput(b), h("small", { class: "sub" }, "Pengunjung bisa geser foto, atau pakai tombol ← →."));
    case "beforeafter":
      return h("div", { class: "blk-body two" },
        mediaInput(b, "before", { label: "Foto sebelum (kiri)" }),
        mediaInput(b, "after", { label: "Foto sesudah (kanan)" }),
        group("Label kiri", bindText(b, "beforeLabel", { label: "Label kiri" })),
        group("Label kanan", bindText(b, "afterLabel", { label: "Label kanan" })),
        h("div", { class: "span-2" }, group("Keterangan", bindText(b, "caption", { label: "Keterangan" }))),
        h("small", { class: "sub span-2" }, "Pakai dua foto dengan ukuran & sudut pandang yang sama supaya hasil geser-nya pas."));
    case "video": {
      const ap = h("input", { type: "checkbox" });
      ap.checked = !!b.autoplay;
      ap.addEventListener("change", () => { b.autoplay = ap.checked; });
      return h("div", { class: "blk-body" },
        mediaInput(b, "url", { accept: "video/*", label: "Video", hint: "Upload MP4 (maks 50 MB), atau tempel link YouTube / Vimeo." }),
        group("Keterangan", bindText(b, "caption", { label: "Keterangan" })),
        h("label", { class: "check" }, ap, "Putar otomatis tanpa suara & berulang (khusus file video, bukan YouTube)"));
    }
  }
  return h("p", { class: "sub" }, "Jenis blok tidak dikenal.");
}

function blockEditor(f, value) {
  const blocks = Array.isArray(value) ? clone(value) : [];
  const list = h("div", { class: "blk-list" });

  const move = (i, d) => { const j = i + d; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; draw(); };
  const remove = i => { if (confirm("Hapus blok ini?")) { blocks.splice(i, 1); draw(); } };

  function card(b, i) {
    const size = h("select", { "aria-label": "Lebar blok" }, SIZES.map(([v, l]) => h("option", { value: v }, l)));
    size.value = b.size || "normal";
    size.addEventListener("change", () => { b.size = size.value; });
    return h("div", { class: "blk-card" },
      h("div", { class: "blk-head" },
        h("strong", {}, `${i + 1}. ${BLOCK_TYPES[b.type]?.label || b.type}`),
        h("span", { class: "blk-tools" },
          size,
          iconBtn("↑", "Pindah ke atas", () => move(i, -1), i === 0),
          iconBtn("↓", "Pindah ke bawah", () => move(i, 1), i === blocks.length - 1),
          iconBtn("✕", "Hapus blok", () => remove(i)))),
      blockBody(b));
  }

  const draw = () => list.replaceChildren(...(blocks.length
    ? blocks.map(card)
    : [h("p", { class: "sub blk-empty" }, "Belum ada konten. Tambahkan blok di bawah: foto, galeri, slider, before/after, video, atau teks.")]));

  const adders = h("div", { class: "blk-add" },
    h("span", { class: "sub" }, "+ Tambah:"),
    Object.entries(BLOCK_TYPES).map(([, d]) => h("button", {
      type: "button", class: "btn ghost sm",
      onclick: () => { blocks.push(d.make()); draw(); list.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" }); },
    }, d.label)));

  draw();
  return {
    node: h("div", { class: "field blk-editor" },
      h("span", {}, f.label),
      h("small", {}, "Susun isi halaman project sesukamu. Atur urutan dengan ↑ ↓ dan lebar tiap blok. Klik Simpan setelah selesai."),
      list, adders),
    get: () => clone(blocks),
  };
}

function buildForm(fields, values, onSave, submitLabel = "Simpan", onCancel) {
  const parts = fields.map(f => field(f, values[f.k]));
  const status = h("span", { class: "status" });
  const btn = h("button", { class: "btn", type: "submit" }, submitLabel);
  return h("form", {
    class: "form",
    onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true;
      status.textContent = "Menyimpan…";
      const vals = Object.fromEntries(fields.map((f, i) => [f.k, parts[i].get()]));
      try {
        await onSave(vals);
        status.textContent = "Tersimpan ✓";
      } catch (err) {
        status.textContent = "Gagal: " + (err.message || err);
      } finally {
        btn.disabled = false;
      }
    },
  },
    parts.map(p => p.node),
    h("div", { class: "actions" },
      btn,
      onCancel ? h("button", { type: "button", class: "btn ghost", onclick: onCancel }, "Batal") : null,
      status));
}

// ---------- Halaman ----------
function showLogin(msg = "") {
  const email = h("input", { type: "email", required: true, autocomplete: "username", placeholder: "Email" });
  const pass = h("input", { type: "password", required: true, autocomplete: "current-password", placeholder: "Password" });
  const status = h("p", { class: "status" }, msg);
  const btn = h("button", { class: "btn", type: "submit" }, "Masuk");
  root.replaceChildren(h("form", {
    class: "login",
    onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true;
      status.textContent = "Masuk…";
      const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
      btn.disabled = false;
      if (error) { status.textContent = "Gagal: " + error.message; return; }
      showDashboard(data.session);
    },
  },
    h("h1", {}, "Admin"),
    h("p", { class: "sub" }, "Masuk untuk mengelola portfolio & CV."),
    email, pass, btn, status));
  email.focus();
}

let currentTab = "profile";

function showDashboard(session) {
  const tabs = [["profile", "Profil"], ["projects", "Portfolio"], ["cv_items", "CV"]];
  const body = h("div", {});
  const nav = h("nav", { class: "tabs" },
    tabs.map(([k, label]) => h("button", { type: "button", "data-k": k, onclick: () => open(k) }, label)));

  root.replaceChildren(
    h("div", { class: "topbar" },
      h("span", { class: "sub" }, session.user.email),
      h("span", { class: "right" },
        h("a", { href: "../", target: "_blank", rel: "noopener" }, "Lihat website ↗"),
        h("button", { class: "btn ghost sm", type: "button", onclick: async () => { await sb.auth.signOut(); showLogin(); } }, "Keluar"))),
    nav, body);

  function open(k) {
    currentTab = k;
    nav.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.k === k));
    if (k === "profile") renderProfile(body);
    else renderList(body, k);
  }
  open(currentTab);
}

async function renderProfile(body) {
  body.replaceChildren(h("p", { class: "sub" }, "Memuat…"));
  const { data, error } = await sb.from("profile").select("*").eq("id", 1).maybeSingle();
  if (error) return body.replaceChildren(errBox(error));
  body.replaceChildren(buildForm(FIELDS.profile, data || {}, async vals => {
    const res = await sb.from("profile").upsert({ id: 1, ...vals, updated_at: new Date().toISOString() }).select();
    if (res.error) throw res.error;
    mustChange(res.data);
  }, "Simpan profil"));
}

async function renderList(body, table) {
  body.replaceChildren(h("p", { class: "sub" }, "Memuat…"));
  const { data, error } = await sb.from(table).select("*").order("sort").order("created_at", { ascending: false });
  if (error) return body.replaceChildren(errBox(error));

  const formSlot = h("div", {});
  const openForm = row => {
    const isNew = !row;
    formSlot.replaceChildren(h("div", { class: "form-box" },
      h("h3", {}, isNew ? "Tambah baru" : "Edit"),
      buildForm(FIELDS[table], row || {}, async vals => {
        if (table === "projects") vals.slug = slugify(vals.slug || vals.title) || null;
        const q = isNew ? sb.from(table).insert(vals) : sb.from(table).update(vals).eq("id", row.id);
        const res = await q.select();
        if (res.error?.code === "23505") throw new Error(`Alamat "${vals.slug}" sudah dipakai project lain. Ganti alamat halamannya.`);
        if (res.error) throw res.error;
        mustChange(res.data);
        renderList(body, table);
      }, isNew ? "Tambah" : "Simpan", () => formSlot.replaceChildren())));
    formSlot.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const remove = async row => {
    if (!confirm(`Hapus "${row.title}"? Ini tidak bisa dibatalkan.`)) return;
    const res = await sb.from(table).delete().eq("id", row.id).select();
    if (res.error) return alert("Gagal: " + res.error.message);
    if (!res.data?.length) return alert("Tidak diizinkan menghapus. Cek email admin di supabase-setup.sql.");
    renderList(body, table);
  };

  const items = data.length
    ? data.map(r => h("div", { class: "item row" },
        h("div", {},
          h("strong", {}, r.title),
          h("div", { class: "sub" }, SUMMARY[table](r).filter(Boolean).join(" · "))),
        h("div", { class: "row-actions" },
          table === "projects" ? h("a", { class: "btn ghost sm", href: projectUrl(r), target: "_blank", rel: "noopener" }, "Lihat ↗") : null,
          h("button", { class: "btn ghost sm", type: "button", onclick: () => openForm(r) }, "Edit"),
          h("button", { class: "btn ghost sm danger", type: "button", onclick: () => remove(r) }, "Hapus"))))
    : [h("p", { class: "sub" }, "Belum ada data. Klik “+ Tambah”.")];

  body.replaceChildren(
    h("div", { class: "list-head" }, h("button", { class: "btn", type: "button", onclick: () => openForm(null) }, "+ Tambah")),
    formSlot,
    ...items);
}

// ---------- Mulai ----------
if (!isConfigured) {
  root.before(h("div", { class: "wrap", style: "padding:24px 24px 0" },
    h("div", { class: "notice", style: "margin:0;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap" },
      h("span", {}, "Mode demo: Supabase belum disambung. Login pakai email & password apa saja. Perubahan cuma tersimpan di browser ini, untuk coba-coba."),
      h("button", {
        class: "btn ghost sm", type: "button",
        onclick: async () => {
          if (!confirm("Kembalikan semua data ke contoh awal?")) return;
          (await import("../demo-client.js")).resetDemo();
          location.reload();
        },
      }, "Reset data contoh"))));
}

const { data: { session } } = await sb.auth.getSession();
if (session) showDashboard(session);
else showLogin();
sb.auth.onAuthStateChange(evt => { if (evt === "SIGNED_OUT") showLogin("Kamu sudah keluar."); });
