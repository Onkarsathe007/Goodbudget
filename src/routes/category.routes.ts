import express, { type Router } from "express";
import { CategoryController } from "../controllers/category.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const categoryRouter: Router = express.Router();

categoryRouter.get("/category", CategoryController.getCategories);
categoryRouter.post(
  "/category",
  requireAdmin,
  CategoryController.addCategories,
);
categoryRouter.delete(
  "/category/:id",
  requireAdmin,
  CategoryController.deleteCategories,
);
categoryRouter.put(
  "/category/:id",
  requireAdmin,
  CategoryController.updateCategory,
);

export default categoryRouter;
