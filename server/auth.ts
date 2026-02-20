import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import type { Express } from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import { storage } from "./storage-simple";
import { users } from "@shared/schema";

type SelectUser = typeof users.$inferSelect;

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const isProduction = app.get("env") === "production";

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "optika-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new session.MemoryStore(),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,

      // ✅ Render/HTTPS uchun MUHIM sozlamalar
      secure: isProduction, // production’da cookie faqat HTTPS’da ishlaydi
      sameSite: isProduction ? "none" : "lax", // cross-site/cookie uchun
    },
  };

  // ✅ secure cookie ishlashi uchun proxy trust
  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);

        if (!user) {
          return done(null, false, { message: "Login yoki parol noto'g'ri" });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
          return done(null, false, { message: "Login yoki parol noto'g'ri" });
        }

        return done(null, user);
      } catch (err) {
        return done(err as any);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? false);
    } catch (err) {
      done(err as any);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res
          .status(401)
          .json({ message: info?.message || "Login xatolik" });
      }

      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);

      // ixtiyoriy: cookie tozalash
      res.clearCookie("connect.sid");

      return res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    return res.json(req.user);
  });
}
