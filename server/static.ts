import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  const publicDir = path.resolve(process.cwd(), "dist", "public");

  // 1) Static fayllar (assets) birinchi bo‘lib servis qilinsin
  app.use(
    express.static(publicDir, {
      index: false, // index.html ni static avtomatik berib yubormasin
    }),
  );

  // 2) SPA fallback:
  // - /api ga tegmasin
  // - va real file (nuqta bor) bo‘lsa index.html qaytarmasin
  app.get(/^\/(?!api(?:\/|$)).*/, (req: Request, res: Response, next: NextFunction) => {
    if (req.path.includes(".")) return next(); // masalan: /assets/index-xxx.js
    return res.sendFile(path.join(publicDir, "index.html"));
  });
}
