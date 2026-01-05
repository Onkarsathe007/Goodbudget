import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import { auth } from "../config/auth.config.js";
import prisma from "../config/db.config.js";
import logger from "../config/logs.config.js";

// Extend Express Request type to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: typeof auth.$Infer.Session.user & { role?: string };
      session?: typeof auth.$Infer.Session.session;
    }
  }
}

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
    req.user = session.user;
    req.session = session.session;

    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);
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
  _res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user) {
      req.user = session.user;
      req.session = session.session;
    }

    next();
  } catch (_error) {
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

      // CRITICAL FIX: Fetch role directly from database
      const userFromDb = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      const userRole = userFromDb?.role;

      logger.debug("[DEBUG] Role Check:", {
        userId: session.user.id,
        email: session.user.email,
        userRole: userRole,
        allowedRoles: allowedRoles,
        hasRole: userRole ? allowedRoles.includes(userRole) : false,
        fetchedFromDb: !!userFromDb,
      });

      if (!userRole || !allowedRoles.includes(userRole)) {
        logger.debug(
          `[FORBIDDEN] User ${session.user.email} has role "${userRole}", needs one of: ${allowedRoles.join(", ")}`,
        );
        return res.status(403).json({
          error: "Forbidden",
          message: `This resource requires one of the following roles: ${allowedRoles.join(", ")}`,
        });
      }

      // Attach user with role to request
      req.user = { ...session.user, role: userRole };
      req.session = session.session;

      next();
    } catch (error) {
      logger.error("Role middleware error:", error);
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
export const requireAdmin = requireRole(["ADMIN"]);
