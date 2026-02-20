import type { Express } from "express";
import express from "express";
import path from "path";

export function serveStatic(app: Express) {
  const publicDir = path.resolve(process.cwd(), "dist", "public");

  // 1) Static assets
  app.use(express.static(publicDir));

  // 2) SPA fallback (match everything)
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
