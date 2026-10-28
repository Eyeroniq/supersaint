import { NextFunction, Request, Response } from "express";

export interface NewUserRequestBody {
  name: string;
  email: string;
  password: string;
  phone?: string;
  gender?: string;
  dob?: string;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface NewProductRequestBody {
  name: string;
  category: string;
  price: number;
  stock: number;
  comparePrice?: number;
  description?: string;
  sizes?: string;
  color?: string;
}

export type ControllerType = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response<any, Record<string, any>>>;

export type SearchRequestQuery = {
  search?: string;
  price?: string;
  category?: string;
  sort?: string;
  page?: string;
};

export interface BaseQuery {
  name?: {
    $regex: string;
    $options: string;
  };
  price?: {
    $lte: number;
  };
  category?: string;
}

export type InvalidateCacheProps = {
  product?: boolean;
  order?: boolean;
  admin?: boolean;
  userId?: string;
  orderId?: string;
  productId?: string | string[];
};

export type OrderItemType = {
  name: string;
  photo: string;
  price: number;
  quantity: number;
  productId: string;
  size?: string;
};

export type ShippingInfoType = {
  name?: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: number;
};

export interface NewOrderRequestBody {
  shippingInfo: ShippingInfoType;
  orderItems: OrderItemType[];
  coupon?: string;
  paymentMethod?: "COD" | "ONLINE";
  razorpay?: {
    orderId: string;
    paymentId: string;
    signature: string;
  };
}
