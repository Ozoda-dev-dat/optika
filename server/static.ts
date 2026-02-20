import type { Express } from "express";
import express from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  const publicDir = path.resolve(process.cwd(), "dist", "public");
  const indexHtml = path.join(publicDir, "index.html");

  // 1) Static fayllar (assets) birinchi
  app.use(
    express.static(publicDir, {
      index: false,      // index.html ni static o'zi avtomat bermasin
      fallthrough: true, // topilmasa keyingi route'ga o'tsin
    }),
  );

  // 2) SPA fallback (Express 5 uchun "*" emas, regex ishlatamiz)
  // /api dan boshlangan yo'llarga tegmaydi
  app.get(/^(?!\/api)(.*)$/, (_req, res) => {
    // index.html yo'q bo'lsa ham aniq xabar
    if (!fs.existsSync(indexHtml)) {
      return res
        .status(500)
        .send(`Build topilmadi: ${indexHtml}. Render build command npm run build bo‘lishi kerak.`);
    }
    res.sendFile(indexHtml);
  });
}
