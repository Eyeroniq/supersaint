import { User } from "../models/user.js";

declare global {
  namespace Express {
    interface Request {
      user?: InstanceType<typeof User>;
    }
  }
}

export {};
