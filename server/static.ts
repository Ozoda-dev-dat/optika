import type { Express } from "express";
import express from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  // Vite config: outDir: "dist/public"
  const publicDir = path.resolve(process.cwd(), "dist", "public");
  const indexHtml = path.join(publicDir, "index.html");

  // 1) Static assetlar (/assets/...) birinchi bo'lsin
  app.use(express.static(publicDir));

  // 2) SPA fallback: faqat API bo'lmagan route'lar uchun
  app.get(/^(?!\/api).*/, (_req, res) => {
    if (!fs.existsSync(indexHtml)) {
      // Render log'da chiqayotgan ENOENT shu yerda ushlanadi
      return res.status(500).send(
        `Client build topilmadi: ${indexHtml}\n` +
          `Render Build Command'da "npm run build" ishlaganini tekshir.`
      );
    }
    return res.sendFile(indexHtml);
  });
}
