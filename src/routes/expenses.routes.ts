import express, { type Router } from "express";
import expenseController from "../controllers/expense.controller.js";
import { requireAdmin, requireAuth } from "../middlewares/auth.middleware.js";

const expenseRouter: Router = express.Router();

expenseRouter.get("/expense", requireAuth, expenseController.getExpenses);
expenseRouter.get(
  "/expense/:id",
  requireAuth,
  expenseController.getExpenseById,
);
expenseRouter.post("/expense", requireAuth, expenseController.setExpenses);
expenseRouter.put("/expense/:id", requireAuth, expenseController.updateExpense);
expenseRouter.delete(
  "/expense/:id",
  requireAuth,
  expenseController.deleteExpense,
);
export default expenseRouter;
