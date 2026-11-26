import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const BUCKET = "portfolio";
export const CV_TYPES = [
  ["pengalaman", "Pengalaman"],
  ["pendidikan", "Pendidikan"],
  ["organisasi", "Organisasi"],
  ["sertifikat", "Sertifikat & Penghargaan"],
];

export const isConfigured =
  SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("GANTI") && !SUPABASE_ANON_KEY.includes("GANTI");

let client;
// Kalau config.js belum diisi → pakai mode demo (data di browser saja).
export async function getClient() {
  if (!client && !isConfigured) client = (await import("./demo-client.js")).client;
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

// Bikin elemen HTML dengan aman (teks tidak pernah dianggap HTML).
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === "") continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// Hanya izinkan link http/https/mailto.
export function safeUrl(u) {
  if (!u) return null;
  try {
    const x = new URL(u, location.href);
    return ["http:", "https:", "mailto:"].includes(x.protocol) ? x.href : null;
  } catch {
    return null;
  }
}
