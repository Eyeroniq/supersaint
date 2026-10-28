import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import { User } from "../models/user.js";
import { LoginRequestBody, NewUserRequestBody } from "../types/types.js";
import { TryCatch } from "../middlewares/error.js";
import { signToken } from "../middlewares/auth.js";
import ErrorHandler from "../utils/utility-class.js";

const publicUser = (user: InstanceType<typeof User>) => {
  const { password, ...rest } = user.toObject();
  return rest;
};

export const register = TryCatch(
  async (
    req: Request<{}, {}, NewUserRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    const { name, email, password, phone, gender, dob } = req.body;

    if (!name || !email || !password)
      return next(new ErrorHandler("Please add name, email and password", 400));

    if (password.length < 6)
      return next(
        new ErrorHandler("Password must be at least 6 characters", 400)
      );

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return next(new ErrorHandler("An account with this email exists", 409));

    const user = await User.create({
      _id: uuid(),
      name,
      email,
      password,
      phone,
      gender: gender || undefined,
      dob: dob ? new Date(dob) : undefined,
    });

    return res.status(201).json({
      success: true,
      message: `Welcome, ${user.name}`,
      token: signToken(user._id),
      user: publicUser(user),
    });
  }
);

export const login = TryCatch(
  async (req: Request<{}, {}, LoginRequestBody>, res, next) => {
    const { email, password } = req.body;

    if (!email || !password)
      return next(new ErrorHandler("Please enter email and password", 400));

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user || !(await user.comparePassword(password)))
      return next(new ErrorHandler("Invalid email or password", 401));

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}`,
      token: signToken(user._id),
      user: publicUser(user),
    });
  }
);

export const getMe = TryCatch(async (req, res, next) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

export const getAllUsers = TryCatch(async (req, res, next) => {
  const users = await User.find({});

  return res.status(200).json({
    success: true,
    users,
  });
});

export const getUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id);

  if (!user) return next(new ErrorHandler("Invalid ID", 400));

  return res.status(200).json({
    success: true,
    user,
  });
});

export const deleteUser = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const user = await User.findById(id);

  if (!user) return next(new ErrorHandler("Invalid ID", 400));

  await user.deleteOne();

  return res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});
