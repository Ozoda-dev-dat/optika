import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  // Vite build natijasi: dist/index.html va dist/assets/...
  const distDir = path.resolve(process.cwd(), "dist");
  const indexHtml = path.join(distDir, "index.html");

  // 1) Statik fayllar (assets, favicon, ...)
  app.use(express.static(distDir));

  // 2) SPA fallback (Express 5 uchun "*" emas!)
  // /api/... emas bo‘lgan hamma narsani index.html ga qaytaramiz
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
}
