import type { Express } from "express";
import express from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
  const cwd = process.cwd();

  // 1) Vite build qayerga chiqayotganini auto topamiz
  const candidates = [
    path.join(cwd, "dist", "public"), // sening loglarda shu chiqqan
    path.join(cwd, "dist"),          // ba'zi setup'larda shu bo'ladi
  ];

  const publicDir = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (!publicDir) {
    throw new Error(
      `Static build not found. Tried: ${candidates
        .map((p) => JSON.stringify(path.join(p, "index.html")))
        .join(", ")}`
    );
  }

  const indexHtml = path.join(publicDir, "index.html");

  // 2) assets
  app.use(express.static(publicDir));

  // 3) SPA fallback (Express 5 compatible) - /api ni tegmaymiz
  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(indexHtml);
  });
}
