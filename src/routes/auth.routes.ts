import { Router } from "express";
import type { Application, Response, Request } from "express";
import { auth } from "../config/auth.config.js";
import { toNodeHandler } from "better-auth/node";

const authRouter: Router = Router();

authRouter.all("/auth/{*any}", toNodeHandler(auth));

/**
 * Better Auth Routes Documentation
 *
 * All routes are automatically handled by Better Auth via the toNodeHandler.
 * Base path: /api/auth
 *
 * AUTHENTICATION ENDPOINTS:
 *
 * Email Sign Up
 *    POST /api/auth/sign-up/email
 *    Body: {
 *      "email": "user@example.com",
 *      "password": "StrongPassword123",
 *      "name": "John Doe"
 *    }
 *    Response: { "user": {...}, "session": {...} }
 *
 * Email Sign In
 *    POST /api/auth/sign-in/email
 *    Body: {
 *      "email": "user@example.com",
 *      "password": "StrongPassword123"
 *    }
 *
 * Google OAuth Sign in (initiated)
 *    POST /api/auth/sign-in/social
 *    Body: {
 *      "provider": "google",
 *      "callbackURL": "/dashboard"
 *    }
 *    Response: { "url": "https://accounts.google.com/o/oauth2/..." }
 *    Client should redirect to the returned URL
 *
 * 4. Google OAuth Callback (Automatic)
 *    GET /api/auth/callback/google?code=...&state=...
 *    This is called automatically by Google after user authorizes.
 *    Better Auth handles this internally and redirects to callbackURL.
 *
 *
 *GET /api/auth/get-session
 *    Credentials: include (cookies sent automatically)
 *    Response: {
 *      "session": {
 *        "user": {
 *          "id": "user_123",
 *          "email": "user@example.com",
 *          "name": "John Doe",
 *          "emailVerified": false,
 *          "image": null,
 *          "createdAt": "2025-01-01T00:00:00.000Z",
 *          "updatedAt": "2025-01-01T00:00:00.000Z"
 *        },
 *        "expiresAt": "2025-01-08T00:00:00.000Z"
 *      }
 *    }
 *    If not logged in: { "session": null }
 *
 * Sign Out
 *    POST /api/auth/sign-out
 *    Credentials: include
 *    Response: { "success": true }
 *
 *
 * NOTES:
 * - Cookies are automatically managed by Better Auth
 * - Cookie name: 'better-auth.session_token'
 * - Session expires in 7 days by default
 * - Use credentials: 'include' in fetch requests to send cookies
 **
 * Example protected route:
 *   app.get('/api/profile', requireAuth, (req, res) => {
 *     res.json({ user: req.user });
 *   });
 */
export default authRouter;
