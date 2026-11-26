// Data contoh: tampil hanya kalau config.js belum diisi.
export const DEMO = {
  demo: true,
  profile: {
    name: "Mikhellon Kwa",
    headline: "Kalimat besar tentang kamu, misalnya: saya membangun produk digital yang sederhana, cepat, dan bermanfaat.",
    location: "Indonesia",
    email: "info@mikhellonkwa.site",
    bio: "Tulis bio kamu dari halaman admin.\n\nSemua teks, project, dan CV di halaman ini bisa diubah tanpa ngoding.",
    skills: ["HTML", "CSS", "JavaScript", "Figma", "Supabase"],
    links: [
      { label: "LinkedIn", url: "https://www.linkedin.com/in/mikhellonkwa/" },
      { label: "GitHub", url: "https://github.com/MikhellonKwa" },
      { label: "Instagram", url: "https://www.instagram.com/mikhellonkwa/" },
    ],
    cv_url: "#cv", // contoh saja; nanti diganti PDF yang diupload dari admin
  },
  projects: [
    { id: "d1", title: "Kasir Online", year: "2026", subtitle: "Aplikasi kasir sederhana untuk UMKM", tags: ["web", "product"], description: "Ceritakan masalahnya, peran kamu, prosesnya, dan hasilnya di sini.", url: "", image_url: "" },
    { id: "d2", title: "Redesign Aplikasi Kampus", year: "2025", subtitle: "Studi kasus UI/UX", tags: ["design"], description: "Deskripsi lengkap project.", url: "", image_url: "" },
    { id: "d3", title: "Dashboard Data", year: "2025", subtitle: "Visualisasi data penjualan", tags: ["web", "data"], description: "Deskripsi lengkap project.", url: "", image_url: "" },
    { id: "d4", title: "Landing Page Event", year: "2024", subtitle: "Website acara himpunan", tags: ["web", "design"], description: "Deskripsi lengkap project.", url: "", image_url: "" },
  ],
  cv: [
    { type: "pengalaman", title: "Posisi / Peran", org: "Nama Perusahaan", period: "2025 — Sekarang", description: "Apa yang kamu kerjakan dan capai." },
    { type: "pengalaman", title: "Magang", org: "Nama Perusahaan", period: "2024", description: "" },
    { type: "pendidikan", title: "Jurusan", org: "Nama Universitas", period: "2021 — 2025", description: "" },
  ],
};
