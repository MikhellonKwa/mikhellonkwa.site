import { h, safeUrl } from "./db.js";

// Bagian yang sama di semua halaman: sidebar, menu HP, footer, animasi.

// Ikon garis (gaya Lucide). Isinya konstanta, bukan data dari user.
const ICONS = {
  cv: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  whatsapp: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

function icon(name, cls) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.75");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  if (cls) s.setAttribute("class", cls);
  s.innerHTML = ICONS[name] || ICONS.link;
  return s;
}

function pickIcon(label, url) {
  const t = `${label} ${url}`.toLowerCase();
  for (const k of ["linkedin", "instagram", "github", "whatsapp"]) if (t.includes(k)) return k;
  if (t.includes("wa.me")) return "whatsapp";
  if (t.startsWith("mailto:") || t.includes("mailto:")) return "mail";
  return "link";
}

// Urutan link: CV, link pertama, Email, lalu sisanya (seperti web Farhan).
export function profileLinks(p) {
  const items = [];
  const cv = safeUrl(p.cv_url);
  if (cv) items.push({ label: "CV", url: cv, icon: "cv" });
  const links = (p.links || [])
    .map(l => ({ label: l.label || l.url, url: safeUrl(l.url) }))
    .filter(l => l.url)
    .map(l => ({ ...l, icon: pickIcon(l.label, l.url) }));
  if (p.email) links.splice(1, 0, { label: "Email", url: "mailto:" + p.email, icon: "mail" });
  return [...items, ...links];
}

const SECTIONS = [["work", "Work", "grid"], ["about", "About", "user"], ["cv", "Experience", "briefcase"], ["contact", "Contact", "chat"]];

export function renderSidebar(p, { base = "" } = {}) {
  const body = document.getElementById("side-body");
  if (!body) return;
  const links = profileLinks(p);
  body.replaceChildren(
    ...links.map(l => h("a", {
      class: "side-link", href: l.url,
      target: l.url.startsWith("mailto:") ? null : "_blank", rel: "noopener",
    }, icon(l.icon), h("span", {}, l.label), icon("ext", "ext"))),
    links.length ? h("div", { class: "side-sep", role: "separator" }) : null,
    ...SECTIONS.map(([id, label, ic]) =>
      h("a", { class: "side-link sec", href: base + "#" + id, "data-sec": id }, icon(ic), h("span", {}, label))));
}

export function setupChrome(name) {
  document.querySelectorAll(".js-brand").forEach(b => { if (name) b.textContent = name; });
  const copy = document.getElementById("copy");
  if (copy) copy.textContent = `© ${new Date().getFullYear()} ${name || ""}`;
  const host = document.getElementById("host");
  if (host) host.textContent = location.hostname;
}

// Sembunyikan menu bagian yang tidak ada (mis. CV masih kosong).
export function hideMissingNav() {
  document.querySelectorAll(".side-link[data-sec]").forEach(a => {
    a.hidden = !document.getElementById(a.dataset.sec);
  });
}

// Menu sidebar di HP (buka/tutup).
export function initDrawer() {
  const btn = document.getElementById("menuBtn");
  const overlay = document.getElementById("overlay");
  const sidebar = document.getElementById("sidebar");
  const set = open => {
    document.body.classList.toggle("nav-open", open);
    btn?.setAttribute("aria-expanded", String(open));
    if (open) sidebar?.querySelector("a")?.focus();
  };
  btn?.addEventListener("click", () => set(!document.body.classList.contains("nav-open")));
  overlay?.addEventListener("click", () => set(false));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("nav-open")) { set(false); btn?.focus(); }
  });
  sidebar?.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
}

export function reveal() {
  const els = document.querySelectorAll(".reveal:not(.in)");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    els.forEach(e => e.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  els.forEach(e => io.observe(e));
}

export const initials = t =>
  (t || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

export const paragraphs = text =>
  (text || "").split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
