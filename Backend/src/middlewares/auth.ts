import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import ErrorHandler from "../utils/utility-class.js";
import { TryCatch } from "./error.js";

export const JWT_SECRET = () => process.env.JWT_SECRET || "supersaint-dev-secret";

export const signToken = (id: string) =>
  jwt.sign({ id }, JWT_SECRET(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  });

const getTokenUserId = (header?: string) => {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET()) as { id: string };
    return payload.id;
  } catch {
    return null;
  }
};

// Middleware to make sure the request carries a valid JWT
export const isAuthenticated = TryCatch(async (req, res, next) => {
  const id = getTokenUserId(req.headers.authorization);
  if (!id) return next(new ErrorHandler("Please login to continue", 401));

  const user = await User.findById(id);
  if (!user) return next(new ErrorHandler("User not found", 401));

  req.user = user;
  next();
});

// Middleware to make sure only admin is allowed
export const adminOnly = TryCatch(async (req, res, next) => {
  const id = getTokenUserId(req.headers.authorization);
  if (!id) return next(new ErrorHandler("Unregistered user", 401));
  const user = await User.findById(id);
  if (!user) return next(new ErrorHandler("User not found", 401));
  if (user.role !== "admin") {
    return next(new ErrorHandler("Not an admin", 403));
  }

  req.user = user;
  next();
});
