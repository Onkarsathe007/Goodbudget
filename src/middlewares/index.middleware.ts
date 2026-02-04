import { toNodeHandler } from "better-auth/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Application } from "express";
import express from "express";
import { auth } from "../config/auth.config.js";
import accountRouter from "../routes/account.routes.js";
import categoryRouter from "../routes/category.routes.js";
import expenseRouter from "../routes/expenses.routes.js";
import userRouter from "../routes/user.routes.js";

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
  app.use("/api", expenseRouter);
  app.use("/api", accountRouter);
  app.use("/api", userRouter);
}
