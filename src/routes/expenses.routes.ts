import express, { type Router } from "express";
import expenseController from "../controllers/expense.controller.js";

const expenseRouter: Router = express.Router();

expenseRouter.get("/expense", expenseController.getExpenses);
expenseRouter.get("/expense/:id", expenseController.getExpenseById);
expenseRouter.post("/expense", expenseController.setExpenses);
expenseRouter.put("/expense/:id", expenseController.updateExpense);
expenseRouter.delete("/expense/:id", expenseController.deleteExpense);
export default expenseRouter;
