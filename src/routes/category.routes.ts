import express from "express";
import prisma from "../config/db.config.js";
import { Router } from "express";
import type { Request, Response } from "express";
import { CategoryController } from "../controllers/category.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const categoryRouter: Router = express.Router();

categoryRouter.get("/category", CategoryController.getCategories);
categoryRouter.post(
  "/category",
  requireAdmin,
  CategoryController.addCategories,
);

export default categoryRouter;
