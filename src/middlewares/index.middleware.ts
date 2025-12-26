import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import { auth } from "../config/auth.config.js";
import type { Application } from "express";

export default function setUpMiddleware(app: Application) {
  app.use(
    cors({
      origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
      credentials: true,
    }),
  );

  app.use(cookieParser());

  app.use("/api/auth", (req, res, next) => {
    // Log auth requests for debugging
    console.log(`[AUTH] ${req.method} ${req.path}`, {
      query: req.query,
      cookies: Object.keys(req.cookies || {}),
    });
    return toNodeHandler(auth)(req, res);
  });

  app.use(express.json());
}
