import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  // Vite build chiqargan joy: dist/public
  const publicDir = path.resolve(process.cwd(), "dist", "public");

  // 1) Static fayllar (assets, icons, manifest, sw.js, va h.k.)
  app.use(
    express.static(publicDir, {
      index: false, // index.html ni fallbackda o'zimiz beramiz
      maxAge: "1y",
      immutable: true,
    }),
  );

  // 2) SPA fallback (API va assets yo'llarini tegmasin)
  // Express 5 uchun: "*" ishlamaydi, regex ishlaydi
  app.get(/^(?!\/api)(?!\/assets)(?!\/favicon\.png)(?!\/manifest\.json)(?!\/sw\.js)(?!\/icons\/).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
