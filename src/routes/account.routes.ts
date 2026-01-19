import { Router } from "express";
import accountController from "../controllers/account.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
const accountRouter: Router = Router();

accountRouter.get("/account", requireAuth, accountController.getAccounts);
accountRouter.get(
  "/account/:id",
  requireAuth,
  accountController.getAccountById,
);
accountRouter.post("/account", requireAuth, accountController.createAccount);
accountRouter.put("/account/:id", requireAuth, accountController.updateAccount);
accountRouter.delete(
  "/account/:id",
  requireAuth,
  accountController.deleteAccount,
);

export default accountRouter;
