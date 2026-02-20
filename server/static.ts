import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  const publicDir = path.resolve(process.cwd(), "dist", "public");
  const assetsDir = path.join(publicDir, "assets");

  // 1) Assets'ni alohida serve qilamiz (topilmasa 404 qaytadi, index.html emas)
  app.use(
    "/assets",
    express.static(assetsDir, {
      fallthrough: false, // MUHIM: topilmasa keyingi route'ga o'tmaydi
    }),
  );

  // 2) Qolgan static fayllar (favicon, robots.txt, etc.)
  app.use(
    express.static(publicDir, {
      index: false, // index.html ni fallback route beradi
    }),
  );

  // 3) API'ni umuman tegmaymiz
  // 4) SPA fallback (Express 5 uchun "*" emas, REGEX ishlatamiz)
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
