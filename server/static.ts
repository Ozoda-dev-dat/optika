import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  // Vite build: dist/public
  const publicDir = path.resolve(process.cwd(), "dist", "public");
  const indexHtml = path.join(publicDir, "index.html");

  // 1) Static assets
  app.use(
    express.static(publicDir, {
      index: false, // index.html ni static o‘zi berib yubormasin, biz fallbackda beramiz
    }),
  );

  // 2) SPA fallback (Express 5 uchun REGEX + fayllarni chetlab o‘tish)
  app.get(/^(?!\/api\/).*/, (req: Request, res: Response, next: NextFunction) => {
    // assets yoki faylga o‘xshagan path bo‘lsa (".js", ".css", ".png"...) fallback qilmang
    if (req.path.startsWith("/assets/")) return next();
    if (req.path.includes(".")) return next();

    return res.sendFile(indexHtml);
  });
}
