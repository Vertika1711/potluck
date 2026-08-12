import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extends Express's Request type so TypeScript knows
// a route can access req.userId after this middleware runs
export interface AuthRequest extends Request {
  userId?: string;
}

// This function runs before any route it's attached to.
// It checks for a valid token and either lets the request through
// or blocks it with an error.
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Tokens are expected in the format: "Authorization: Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verifies the token was signed with our secret and hasn't expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };

    // Attach the verified user ID to the request, so the actual route
    // handler can use it (e.g. to fetch that user's data)
    req.userId = decoded.userId;

    next(); // let the request continue to the actual route
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}