import { Router } from "express";
import userController from "../controllers/user.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const userRouter: Router = Router();

userRouter.get("/user/profile", requireAuth, userController.getProfile);
userRouter.put("/user/profile", requireAuth, userController.updateProfile);
userRouter.get("/user/balance", requireAuth, userController.getBalance);
userRouter.get("/user/stats", requireAuth, userController.getStats);
userRouter.post(
  "/user/balance/reconcile",
  requireAuth,
  userController.reconcileBalance,
);
userRouter.get(
  "/user/balance/validate",
  requireAuth,
  userController.validateBalance,
);

export default userRouter;
