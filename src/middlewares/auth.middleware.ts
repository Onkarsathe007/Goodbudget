import type { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth.config.js";
import { fromNodeHeaders } from "better-auth/node";

/**
 * Middleware to check if user is authenticated
 * Attaches session to req.user if authenticated
 */

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "You must be logged in to access this resource",
      });
    }

    // Attach user and session to request object
    (req as any).user = session.user;
    (req as any).session = session.session;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired session",
    });
  }
};

/**
 * Middleware to optionally attach user if authenticated
 * Does not block request if not authenticated
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session && session.user) {
      (req as any).user = session.user;
      (req as any).session = session.session;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * Middleware to check if user has specific role
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session || !session.user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "You must be logged in to access this resource",
        });
      }

      const userRole = (session.user as any).role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: "Forbidden",
          message: `This resource requires one of the following roles: ${allowedRoles.join(", ")}`,
        });
      }

      (req as any).user = session.user;
      (req as any).session = session.session;

      next();
    } catch (error) {
      console.error("Role middleware error:", error);
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired session",
      });
    }
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole(["admin"]);
