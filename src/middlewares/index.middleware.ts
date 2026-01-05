import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Application } from "express";
import express from "express";
import { auth } from "../config/auth.config.js";
import categoryRouter from "../routes/category.routes.js";

export default function setUpMiddleware(app: Application) {
  app.use(
    cors({
      origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json());

  app.use("/api/auth", (req, res, _next) => {
    return toNodeHandler(auth)(req, res);
  });

  app.use("/api", categoryRouter);
}
