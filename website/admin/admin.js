import { getClient, isConfigured, CV_TYPES, BUCKET, h, slugify, projectUrl, MONTHS, fmtPeriod, sortProjects, sortCv } from "../db.js";

const root = document.getElementById("admin");
const sb = await getClient();

// ---------- Form fields ----------
const YEARS = Array.from({ length: 2050 - 1980 + 1 }, (_, i) => String(2050 - i)); // 2050 → 1980

const PROFILE_FIELDS = [
  { k: "name", label: "Name", req: true },
  { k: "email", label: "Public email", type: "email" },
  { k: "bio", label: "About (bio)", type: "textarea", rows: 6, hint: "Separate paragraphs with an empty line." },
  { k: "skills", label: "Skills", type: "tags", hint: "Separate with commas." },
  { k: "links", label: "Links", type: "links", hint: "One per line → Label | URL   (e.g. GitHub | https://github.com/username)" },
  { k: "cv_url", label: "CV file (PDF)", type: "file", accept: "application/pdf", folder: "cv", hint: "Shown as the “CV” link in the sidebar." },
];

const projectFields = research => [
  { k: "title", label: "Title", req: true },
  { k: "slug", label: "Page address", type: "slug", hint: "Leave empty to generate it from the title. Lowercase letters, numbers and - only." },
  { k: "subtitle", label: "Short subtitle", hint: "Shown under the title on the card." },
  { k: "year", label: "Year", type: "year", hint: "Projects are sorted automatically, newest year first." },
  { k: "location", label: "Location", hint: "City, Country (e.g. Jakarta, Indonesia). Shown as “2027 | Jakarta, Indonesia”." },
  research ? { k: "pdf_url", label: "Paper (PDF)", type: "file", accept: "application/pdf", folder: "papers", hint: "Visitors can read a preview on the project page and download the PDF. Max 50 MB." } : null,
  { k: "description", label: "Description", type: "textarea", rows: 6, hint: "Intro text on the project page. Separate paragraphs with an empty line." },
  { k: "links", label: "Links", type: "linklist", hint: "Add as many as you like (e.g. Behance, Publication, Competition page). Each shows on the project page as “Label ↗”." },
  { k: "tags", label: "Categories / tags", type: "tags", hint: "Separate with commas. Also used as filters on the home page (e.g. residential, interior)." },
  { k: "image_url", label: "Cover image (card thumbnail)", type: "file", accept: "image/*", folder: "projects", hint: "Shown on the home page card. On the project page, the cover only appears when there are no content blocks." },
  { k: "blocks", label: "Project page content", type: "blocks" },
].filter(Boolean);

const CV_FIELDS = [
  { k: "type", label: "Section", type: "select", options: CV_TYPES },
  { k: "title", label: "Company / Institution", req: true, hint: "e.g. ALIEN Design Consultant, Universitas Indonesia, IAI" },
  { k: "org", label: "Position / Major / Title", hint: "e.g. Junior Architect, Bachelor of Architecture" },
  { k: "period", label: "Period", type: "period" },
  { k: "description", label: "Description", type: "textarea" },
];

// Tabs in the admin and what each one manages.
const LISTS = {
  design: { table: "projects", kind: "work", fields: projectFields(false), noun: "design project", sort: sortProjects },
  research: { table: "projects", kind: "research", fields: projectFields(true), noun: "research", sort: sortProjects },
  cv: { table: "cv_items", fields: CV_FIELDS, noun: "entry", sort: sortCv },
};

const SUMMARY = {
  projects: r => [r.year, r.location, r.pdf_url ? "PDF" : null, (r.tags || []).join(", "), r.slug ? "/project/" + r.slug : null,
    Array.isArray(r.blocks) && r.blocks.length ? `${r.blocks.length} content block${r.blocks.length > 1 ? "s" : ""}` : null],
  cv_items: r => [CV_TYPES.find(([k]) => k === r.type)?.[1], r.org, fmtPeriod(r.start_ym, r.end_ym) || r.period],
};

// ---------- Helpers ----------
async function upload(file, folder) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function errBox(error) {
  const msg = error.message || String(error);
  const hint = /relation|does not exist|schema cache|column/i.test(msg)
    ? " The database may be missing a column — run supabase-setup.sql again."
    : "";
  return h("div", { class: "notice" }, "Error: " + msg + hint);
}

// Supabase doesn't error when row-level security blocks an update/delete; it just changes 0 rows.
function mustChange(data) {
  if (!data || !data.length) throw new Error("Not allowed. Make sure you are signed in with the admin email.");
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

const option = (value, label) => h("option", { value }, label);

// Month + year dropdowns. "present" and "" (no end date) are allowed for the end.
function periodField(f, row) {
  const monthSel = () => h("select", { "aria-label": "Month" }, option("", "Month"), MONTHS.map((m, i) => option(String(i + 1).padStart(2, "0"), m)));
  const sm = monthSel(), em = monthSel();
  const sy = h("select", { "aria-label": "Start year" }, option("", "Year"), YEARS.map(y => option(y, y)));
  const ey = h("select", { "aria-label": "End year" },
    option("present", "Present"), option("none", "No end date"), YEARS.map(y => option(y, y)));

  const [s1, s2] = (row.start_ym || "").split("-");
  sy.value = s1 || ""; sm.value = s2 || "";
  if (row.end_ym === "present" || (!row.end_ym && !row.start_ym)) ey.value = "present";
  else if (!row.end_ym) ey.value = "none";
  else { const [e1, e2] = row.end_ym.split("-"); ey.value = e1; em.value = e2 || ""; }

  const preview = h("small", { class: "slug-preview" });
  const value = () => {
    const start_ym = sy.value ? `${sy.value}-${sm.value || "01"}` : "";
    const end_ym = ey.value === "present" ? "present" : ey.value === "none" ? "" : `${ey.value}-${em.value || "01"}`;
    return { start_ym, end_ym, period: fmtPeriod(start_ym, end_ym) };
  };
  const sync = () => {
    em.disabled = ey.value === "present" || ey.value === "none";
    preview.textContent = value().period ? "Shown as: " + value().period : "";
  };
  [sm, sy, em, ey].forEach(s => s.addEventListener("change", sync));
  sync();

  return {
    node: h("div", { class: "field" }, h("span", {}, f.label),
      h("div", { class: "period-grid" },
        h("span", { class: "sub" }, "Start"), sm, sy,
        h("span", { class: "sub" }, "End"), em, ey),
      preview),
    get: () => {
      const v = value();
      if (!v.start_ym) throw new Error("Choose a start month and year.");
      if (v.end_ym && v.end_ym !== "present" && v.end_ym < v.start_ym) throw new Error("The end date is before the start date.");
      return v;
    },
    multi: true,
  };
}

// Several links, each with a label. Older projects with a single "url" are carried over.
const hostLabel = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
function linkListField(f, v, row) {
  let items = Array.isArray(v) ? clone(v) : [];
  if (!items.length && row.url) items = [{ label: "Open project", url: row.url }];
  const list = h("div", { class: "link-list" });
  const swap = (i, j) => { [items[i], items[j]] = [items[j], items[i]]; draw(); };
  const draw = () => list.replaceChildren(...(items.length ? items.map((it, i) => {
    const label = h("input", { type: "text", placeholder: "Label (e.g. Behance)", "aria-label": `Link ${i + 1} label` });
    label.value = it.label || "";
    label.addEventListener("input", () => { it.label = label.value; });
    const url = h("input", { type: "url", placeholder: "https://…", "aria-label": `Link ${i + 1} URL` });
    url.value = it.url || "";
    url.addEventListener("input", () => { it.url = url.value; });
    return h("div", { class: "link-row" }, label, url,
      iconBtn("↑", "Move up", () => swap(i, i - 1), i === 0),
      iconBtn("✕", "Remove link", () => { items.splice(i, 1); draw(); }));
  }) : [h("p", { class: "sub" }, "No links yet.")]));
  const add = h("button", {
    type: "button", class: "btn ghost sm",
    onclick: () => { items.push({ label: "", url: "" }); draw(); list.lastElementChild?.querySelector("input")?.focus(); },
  }, "+ Add link");
  draw();
  return {
    node: group(f.label, list, h("div", {}, add), f.hint ? h("small", {}, f.hint) : null),
    get: () => items
      .map(it => ({ label: (it.label || "").trim(), url: (it.url || "").trim() }))
      .filter(it => it.url)
      .map(it => {
        if (!/^https?:\/\//i.test(it.url)) throw new Error(`Link "${it.url}" must start with https://`);
        return { label: it.label || hostLabel(it.url), url: it.url };
      }),
  };
}

function field(f, v, row) {
  if (f.type === "blocks") return blockEditor(f, v);
  if (f.type === "period") return periodField(f, row);
  if (f.type === "linklist") return linkListField(f, v, row);
  let input;
  const extra = [];

  if (f.type === "slug") {
    input = h("input", { type: "text", placeholder: "generated from the title", spellcheck: "false" });
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
    input = h("select", {}, f.options.map(([val, label]) => option(val, label)));
    input.value = v ?? f.options[0][0];
  } else if (f.type === "year") {
    input = h("select", {}, option("", "—"), YEARS.map(y => option(y, y)));
    input.value = YEARS.includes(String(v)) ? String(v) : "";
  } else if (f.type === "tags") {
    input = h("input", { type: "text" });
    input.value = (v || []).join(", ");
  } else if (f.type === "links") {
    input = h("textarea", { rows: 4, placeholder: "GitHub | https://github.com/username" });
    input.value = (v || []).map(l => `${l.label} | ${l.url}`).join("\n");
  } else if (f.type === "file") {
    input = h("input", { type: "url", placeholder: "Upload a file below, or paste a URL" });
    input.value = v ?? "";
    const preview = h("div", { class: "preview" });
    const status = h("span", { class: "status" });
    const showPreview = () => {
      const u = input.value.trim();
      preview.replaceChildren(
        !u ? "" : f.accept.startsWith("image")
          ? h("img", { src: u, alt: "" })
          : h("a", { href: u, target: "_blank", rel: "noopener" }, "View file ↗"));
    };
    const fileIn = h("input", {
      type: "file", accept: f.accept,
      onchange: async () => {
        const file = fileIn.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { status.textContent = "File is larger than 50 MB. Please make it smaller."; fileIn.value = ""; return; }
        status.textContent = "Uploading…";
        try {
          input.value = await upload(file, f.folder);
          status.textContent = "Uploaded ✓ (remember to click Save)";
          showPreview();
        } catch (e) {
          status.textContent = "Upload failed: " + e.message;
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
    input,
  };
}

// ---------- Content block editor (project page) ----------
const BLOCK_TYPES = {
  text: { label: "Text", make: () => ({ type: "text", text: "", size: "small" }) },
  image: { label: "Image", make: () => ({ type: "image", url: "", caption: "", size: "normal" }) },
  gallery: { label: "Gallery", make: () => ({ type: "gallery", images: [], columns: 2, size: "normal" }) },
  slider: { label: "Slider", make: () => ({ type: "slider", images: [], size: "normal" }) },
  beforeafter: { label: "Before / After", make: () => ({ type: "beforeafter", before: "", after: "", beforeLabel: "Before", afterLabel: "After", caption: "", size: "normal" }) },
  video: { label: "Video", make: () => ({ type: "video", url: "", caption: "", autoplay: false, size: "normal" }) },
};
const SIZES = [["small", "Width: small"], ["normal", "Width: medium"], ["full", "Width: full"]];
const clone = v => JSON.parse(JSON.stringify(v ?? null));

const iconBtn = (text, label, onclick, disabled) =>
  h("button", { type: "button", class: "btn ghost sm icon", "aria-label": label, title: label, onclick, disabled: !!disabled }, text);

// Labelled group (a div, since it can hold more than one input).
const group = (label, ...kids) => h("div", { class: "field" }, h("span", {}, label), kids);

function bindText(obj, key, { area = false, rows = 4, placeholder = "", label = "" } = {}) {
  const el = area ? h("textarea", { rows, placeholder, "aria-label": label }) : h("input", { type: "text", placeholder, "aria-label": label });
  el.value = obj[key] ?? "";
  el.addEventListener("input", () => { obj[key] = el.value; });
  return el;
}

// One file (image / video): upload or paste a URL.
function mediaInput(obj, key, { accept = "image/*", label = "Image", hint = "" } = {}) {
  const url = h("input", { type: "url", placeholder: "Upload a file, or paste a URL", "aria-label": label });
  url.value = obj[key] || "";
  const preview = h("div", { class: "preview" });
  const status = h("span", { class: "status" });
  const show = () => {
    const u = url.value.trim();
    obj[key] = u;
    const isEmbed = /youtu\.?be|vimeo\.com/.test(u);
    preview.replaceChildren(!u ? "" : accept.startsWith("image") ? h("img", { src: u, alt: "" })
      : !isEmbed ? h("video", { src: u, controls: true, preload: "metadata" })
      : h("a", { href: u, target: "_blank", rel: "noopener" }, "View video ↗"));
  };
  const file = h("input", {
    type: "file", accept, "aria-label": "Choose file: " + label,
    onchange: async () => {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 50 * 1024 * 1024) { status.textContent = "File is larger than 50 MB. Make it smaller, or upload to YouTube and paste the link."; file.value = ""; return; }
      status.textContent = "Uploading…";
      try {
        url.value = await upload(f, accept.startsWith("video") ? "videos" : "projects");
        status.textContent = "Uploaded ✓";
        show();
      } catch (e) { status.textContent = "Upload failed: " + e.message; }
      file.value = "";
    },
  });
  url.addEventListener("input", show);
  show();
  return group(label, url, file, status, preview, hint ? h("small", {}, hint) : null);
}

// Several images (gallery / slider): bulk upload, reorder, captions.
function imagesInput(obj) {
  obj.images = Array.isArray(obj.images) ? obj.images : [];
  const list = h("div", { class: "img-list" });
  const status = h("span", { class: "status" });
  const swap = (i, j) => { [obj.images[i], obj.images[j]] = [obj.images[j], obj.images[i]]; draw(); };
  const draw = () => list.replaceChildren(...obj.images.map((im, i) => {
    const cap = h("input", { type: "text", placeholder: "Caption (optional)", "aria-label": `Caption for image ${i + 1}` });
    cap.value = im.caption || "";
    cap.addEventListener("input", () => { im.caption = cap.value; });
    return h("div", { class: "img-item" },
      h("img", { src: im.url, alt: `Image ${i + 1}` }),
      cap,
      h("div", { class: "img-tools" },
        iconBtn("←", "Move left", () => swap(i, i - 1), i === 0),
        iconBtn("→", "Move right", () => swap(i, i + 1), i === obj.images.length - 1),
        iconBtn("✕", "Remove image", () => { obj.images.splice(i, 1); draw(); })));
  }));
  const file = h("input", {
    type: "file", accept: "image/*", multiple: true, "aria-label": "Choose images (multiple allowed)",
    onchange: async () => {
      const files = [...file.files];
      for (const [n, f] of files.entries()) {
        status.textContent = `Uploading ${n + 1} of ${files.length}…`;
        try { obj.images.push({ url: await upload(f, "projects"), caption: "" }); draw(); }
        catch (e) { status.textContent = "Upload failed: " + e.message; file.value = ""; return; }
      }
      status.textContent = `${files.length} image${files.length > 1 ? "s" : ""} uploaded ✓`;
      file.value = "";
    },
  });
  draw();
  return group("Images (you can select several at once)", file, status, list);
}

function blockBody(b) {
  switch (b.type) {
    case "text":
      return group("Text", bindText(b, "text", { area: true, rows: 6, label: "Text", placeholder: "Separate paragraphs with an empty line" }));
    case "image":
      return h("div", { class: "blk-body" }, mediaInput(b, "url", { label: "Image" }), group("Caption", bindText(b, "caption", { label: "Caption" })));
    case "gallery": {
      const cols = h("select", { "aria-label": "Columns" }, [1, 2, 3].map(n => option(String(n), `${n} column${n > 1 ? "s" : ""}`)));
      cols.value = String(b.columns || 2);
      cols.addEventListener("change", () => { b.columns = +cols.value; });
      return h("div", { class: "blk-body" }, group("Layout", cols), imagesInput(b));
    }
    case "slider":
      return h("div", { class: "blk-body" }, imagesInput(b), h("small", { class: "sub" }, "Visitors can swipe, or use the ← → buttons."));
    case "beforeafter":
      return h("div", { class: "blk-body two" },
        mediaInput(b, "before", { label: "Before image (left)" }),
        mediaInput(b, "after", { label: "After image (right)" }),
        group("Left label", bindText(b, "beforeLabel", { label: "Left label" })),
        group("Right label", bindText(b, "afterLabel", { label: "Right label" })),
        h("div", { class: "span-2" }, group("Caption", bindText(b, "caption", { label: "Caption" }))),
        h("small", { class: "sub span-2" }, "Use two images with the same size and angle so the comparison lines up."));
    case "video": {
      const ap = h("input", { type: "checkbox" });
      ap.checked = !!b.autoplay;
      ap.addEventListener("change", () => { b.autoplay = ap.checked; });
      return h("div", { class: "blk-body" },
        mediaInput(b, "url", { accept: "video/*", label: "Video", hint: "Upload an MP4 (max 50 MB), or paste a YouTube / Vimeo link." }),
        group("Caption", bindText(b, "caption", { label: "Caption" })),
        h("label", { class: "check" }, ap, "Autoplay muted & loop (video files only, not YouTube)"));
    }
  }
  return h("p", { class: "sub" }, "Unknown block type.");
}

function blockEditor(f, value) {
  const blocks = Array.isArray(value) ? clone(value) : [];
  const list = h("div", { class: "blk-list" });

  const move = (i, d) => { const j = i + d; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; draw(); };
  const remove = i => { if (confirm("Delete this block?")) { blocks.splice(i, 1); draw(); } };

  function card(b, i) {
    const size = h("select", { "aria-label": "Block width" }, SIZES.map(([v, l]) => option(v, l)));
    size.value = b.size || "normal";
    size.addEventListener("change", () => { b.size = size.value; });
    return h("div", { class: "blk-card" },
      h("div", { class: "blk-head" },
        h("strong", {}, `${i + 1}. ${BLOCK_TYPES[b.type]?.label || b.type}`),
        h("span", { class: "blk-tools" },
          size,
          iconBtn("↑", "Move up", () => move(i, -1), i === 0),
          iconBtn("↓", "Move down", () => move(i, 1), i === blocks.length - 1),
          iconBtn("✕", "Delete block", () => remove(i)))),
      blockBody(b));
  }

  const draw = () => list.replaceChildren(...(blocks.length
    ? blocks.map(card)
    : [h("p", { class: "sub blk-empty" }, "No content yet. Add blocks below: image, gallery, slider, before/after, video or text.")]));

  const adders = h("div", { class: "blk-add" },
    h("span", { class: "sub" }, "+ Add:"),
    Object.entries(BLOCK_TYPES).map(([, d]) => h("button", {
      type: "button", class: "btn ghost sm",
      onclick: () => { blocks.push(d.make()); draw(); list.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" }); },
    }, d.label)));

  draw();
  return {
    node: h("div", { class: "field blk-editor" },
      h("span", {}, f.label),
      h("small", {}, "Build the project page however you like. Reorder with ↑ ↓ and set each block's width. Click Save when you're done."),
      list, adders),
    get: () => clone(blocks),
  };
}

function buildForm(fields, values, onSave, submitLabel = "Save", onCancel) {
  const parts = fields.map(f => field(f, values[f.k], values));
  const status = h("span", { class: "status" });
  const btn = h("button", { class: "btn", type: "submit" }, submitLabel);
  return h("form", {
    class: "form",
    onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true;
      status.textContent = "Saving…";
      try {
        const vals = {};
        fields.forEach((f, i) => {
          const v = parts[i].get();
          if (parts[i].multi) Object.assign(vals, v); else vals[f.k] = v;
        });
        await onSave(vals);
        status.textContent = "Saved ✓";
      } catch (err) {
        status.textContent = "Couldn't save: " + (err.message || err);
      } finally {
        btn.disabled = false;
      }
    },
  },
    parts.map(p => p.node),
    h("div", { class: "actions" },
      btn,
      onCancel ? h("button", { type: "button", class: "btn ghost", onclick: onCancel }, "Cancel") : null,
      status));
}

// ---------- Pages ----------
function showLogin(msg = "") {
  const email = h("input", { type: "email", required: true, autocomplete: "username", placeholder: "Email" });
  const pass = h("input", { type: "password", required: true, autocomplete: "current-password", placeholder: "Password" });
  const status = h("p", { class: "status" }, msg);
  const btn = h("button", { class: "btn", type: "submit" }, "Sign in");
  root.replaceChildren(h("form", {
    class: "login",
    onsubmit: async e => {
      e.preventDefault();
      btn.disabled = true;
      status.textContent = "Signing in…";
      const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
      btn.disabled = false;
      if (error) { status.textContent = "Couldn't sign in: " + error.message; return; }
      showDashboard(data.session);
    },
  },
    h("h1", {}, "Admin"),
    h("p", { class: "sub" }, "Sign in to manage your portfolio."),
    email, pass, btn, status));
  email.focus();
}

let currentTab = "profile";

function showDashboard(session) {
  const tabs = [["profile", "Profile"], ["design", "Design"], ["research", "Research"], ["cv", "Personal Background"]];
  const body = h("div", {});
  const nav = h("nav", { class: "tabs" },
    tabs.map(([k, label]) => h("button", { type: "button", "data-k": k, onclick: () => open(k) }, label)));

  root.replaceChildren(
    h("div", { class: "topbar" },
      h("span", { class: "sub" }, session.user.email),
      h("span", { class: "right" },
        h("a", { href: "../", target: "_blank", rel: "noopener" }, "View site ↗"),
        h("button", { class: "btn ghost sm", type: "button", onclick: async () => { await sb.auth.signOut(); showLogin(); } }, "Sign out"))),
    nav, body);

  function open(k) {
    currentTab = k;
    nav.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.k === k));
    if (k === "profile") renderProfile(body);
    else renderList(body, k);
  }
  open(LISTS[currentTab] || currentTab === "profile" ? currentTab : "profile");
}

// Maintenance switch: saved the moment it's clicked.
function maintenanceCard(profile) {
  const toggle = h("input", { type: "checkbox", class: "switch", role: "switch", "aria-label": "Maintenance mode" });
  toggle.checked = !!profile.maintenance;
  const msg = h("textarea", { rows: 2, placeholder: "This site is being updated. Please check back soon.", "aria-label": "Maintenance message" });
  msg.value = profile.maintenance_message || "";
  const status = h("span", { class: "status" });
  const card = h("div", { class: "maint-card" });
  const state = h("p", { class: "maint-state" });
  const paint = () => {
    card.classList.toggle("on", toggle.checked);
    state.textContent = toggle.checked
      ? "ON: visitors now see the “Under maintenance” page."
      : "Off: the site is live for everyone.";
  };
  const save = async (fields, okText) => {
    status.textContent = "Saving…";
    const res = await sb.from("profile").update(fields).eq("id", 1).select();
    if (res.error || !res.data?.length) {
      status.textContent = "Couldn't save: " + (res.error?.message || "not allowed");
      return false;
    }
    status.textContent = okText;
    return true;
  };
  toggle.addEventListener("change", async () => {
    toggle.disabled = true;
    const ok = await save({ maintenance: toggle.checked, maintenance_message: msg.value.trim() },
      toggle.checked ? "Maintenance turned on ✓" : "Maintenance turned off ✓");
    if (!ok) toggle.checked = !toggle.checked;
    toggle.disabled = false;
    paint();
  });
  const saveMsg = h("button", { type: "button", class: "btn ghost sm",
    onclick: () => save({ maintenance_message: msg.value.trim() }, "Message saved ✓") }, "Save message");
  paint();
  card.append(
    h("label", { class: "maint-head" }, toggle, h("strong", {}, "Maintenance mode")),
    state,
    h("div", { class: "field" }, h("span", {}, "Message for visitors (optional)"), msg),
    h("div", { class: "actions" }, saveMsg, status,
      h("a", { href: "/", target: "_blank", rel: "noopener", class: "sub" }, "View site ↗")),
    h("small", { class: "sub" }, "While it's on, you still see the real site as long as you're signed in on this browser."));
  return card;
}

async function renderProfile(body) {
  body.replaceChildren(h("p", { class: "sub" }, "Loading…"));
  const { data, error } = await sb.from("profile").select("*").eq("id", 1).maybeSingle();
  if (error) return body.replaceChildren(errBox(error));
  body.replaceChildren(maintenanceCard(data || {}), buildForm(PROFILE_FIELDS, data || {}, async vals => {
    const res = await sb.from("profile").upsert({ id: 1, ...vals, updated_at: new Date().toISOString() }).select();
    if (res.error) throw res.error;
    mustChange(res.data);
  }, "Save profile"));
}

async function renderList(body, key) {
  const conf = LISTS[key];
  body.replaceChildren(h("p", { class: "sub" }, "Loading…"));
  let q = sb.from(conf.table).select("*").order("created_at", { ascending: false });
  if (conf.kind) q = q.eq("kind", conf.kind);
  const { data, error } = await q;
  if (error) return body.replaceChildren(errBox(error));
  const rows = conf.sort(data || []);

  const formSlot = h("div", {});
  const openForm = row => {
    const isNew = !row;
    formSlot.replaceChildren(h("div", { class: "form-box" },
      h("h3", {}, isNew ? `New ${conf.noun}` : "Edit"),
      buildForm(conf.fields, row || {}, async vals => {
        if (conf.kind) vals.kind = conf.kind;
        if (conf.table === "projects") {
          vals.slug = slugify(vals.slug || vals.title) || null;
          vals.url = vals.links?.[0]?.url || ""; // kolom lama, tetap diisi link pertama
        }
        const q = isNew ? sb.from(conf.table).insert(vals) : sb.from(conf.table).update(vals).eq("id", row.id);
        const res = await q.select();
        if (res.error?.code === "23505") throw new Error(`The address "${vals.slug}" is already used by another project. Choose a different page address.`);
        if (res.error) throw res.error;
        mustChange(res.data);
        renderList(body, key);
      }, isNew ? "Add" : "Save", () => formSlot.replaceChildren())));
    formSlot.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const remove = async row => {
    if (!confirm(`Delete "${row.title}"? This can't be undone.`)) return;
    const res = await sb.from(conf.table).delete().eq("id", row.id).select();
    if (res.error) return alert("Couldn't delete: " + res.error.message);
    if (!res.data?.length) return alert("Not allowed to delete. Make sure you are signed in with the admin email.");
    renderList(body, key);
  };

  const items = rows.length
    ? rows.map(r => h("div", { class: "item row" },
        h("div", {},
          h("strong", {}, r.title),
          h("div", { class: "sub" }, SUMMARY[conf.table](r).filter(Boolean).join(" · "))),
        h("div", { class: "row-actions" },
          conf.table === "projects" ? h("a", { class: "btn ghost sm", href: projectUrl(r), target: "_blank", rel: "noopener" }, "View ↗") : null,
          h("button", { class: "btn ghost sm", type: "button", onclick: () => openForm(r) }, "Edit"),
          h("button", { class: "btn ghost sm danger", type: "button", onclick: () => remove(r) }, "Delete"))))
    : [h("p", { class: "sub" }, `Nothing here yet. Click “+ Add”.`)];

  body.replaceChildren(
    h("div", { class: "list-head" },
      h("button", { class: "btn", type: "button", onclick: () => openForm(null) }, "+ Add"),
      h("span", { class: "sub" }, conf.table === "projects" ? "Sorted automatically: newest year first." : "Sorted automatically: most recent first.")),
    formSlot,
    ...items);
}

// ---------- Start ----------
if (!isConfigured) {
  root.before(h("div", { class: "wrap", style: "padding:24px 24px 0" },
    h("div", { class: "notice", style: "margin:0;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap" },
      h("span", {}, "Demo mode: Supabase isn't connected. Sign in with any email & password. Changes are only stored in this browser."),
      h("button", {
        class: "btn ghost sm", type: "button",
        onclick: async () => {
          if (!confirm("Reset all data to the sample content?")) return;
          (await import("../demo-client.js")).resetDemo();
          location.reload();
        },
      }, "Reset sample data"))));
}

const { data: { session } } = await sb.auth.getSession();
if (session) showDashboard(session);
else showLogin();
sb.auth.onAuthStateChange(evt => { if (evt === "SIGNED_OUT") showLogin("You've signed out."); });
