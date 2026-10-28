import mongoose, { Document } from "mongoose";
import validator from "validator";
import bcrypt from "bcryptjs";

interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  photo: string;
  role: "admin" | "user";
  gender?: "male" | "female";
  dob?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Virtual Attribute
  age: number;
  comparePassword(candidate: string): Promise<boolean>;

}

const schema = new mongoose.Schema<IUser>(
  {
    _id: {
      type: String,
      required: [true, "Please enter ID"],
    },
    name: {
      type: String,
      required: [true, "Please enter Name"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Please enter Email"],
      lowercase: true,
      trim: true,
      validate: validator.default.isEmail,
    },
    password: {
      type: String,
      required: [true, "Please enter Password"],
      minlength: [6, "Password must be at least 6 characters"],
      // Never returned from queries unless explicitly selected
      select: false,
    },
    phone: {
      type: String,
      default: "",
    },
    photo: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    dob: {
      type: Date,
    },
  },
  { timestamps: true }
);

schema.pre("save", async function (this: any, next: (err?: Error) => void) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

schema.methods.comparePassword = function (this: any, candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

schema.virtual("age").get(function (this: any) {
  if (!this.dob) return 0;
  const today = new Date();
  const dob: Date = this.dob;
  let age = today.getFullYear() - dob.getFullYear();
  if (
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
  ) {
    age--;
  }
  return age;
});

export const User = mongoose.model<IUser>("User", schema);
