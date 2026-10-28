import express from "express";
import {
  deleteUser,
  getAllUsers,
  getMe,
  getUser,
  login,
  register,
} from "../controllers/user.js";
import { adminOnly, isAuthenticated } from "../middlewares/auth.js";

const app = express.Router();

// route - /api/v1/user/register
app.post("/register", register);

// route - /api/v1/user/login
app.post("/login", login);

// route - /api/v1/user/me
app.get("/me", isAuthenticated, getMe);

// route - /api/v1/user/all
app.get("/all", adminOnly, getAllUsers);

// route - /api/v1/user/dynamicID
app.route("/:id").get(adminOnly, getUser).delete(adminOnly, deleteUser);

export default app;
