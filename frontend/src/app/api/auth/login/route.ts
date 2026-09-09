import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import type { UserDocument } from "@/types/user";

type LoginBody = {
  email?: string;
  password?: string;
};

const INVALID_CREDENTIALS_MESSAGE = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const users = client.db("torfinder").collection<UserDocument>("users");

    const user = await users.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    }

    if (user.status !== "approved") {
      return NextResponse.json(
        { error: "บัญชีของคุณยังไม่ได้รับการอนุมัติ", status: user.status },
        { status: 403 }
      );
    }

    const token = await createSessionToken({
      userId: user._id?.toString() ?? "",
      email: user.email,
      status: user.status,
    });

    const response = NextResponse.json({ success: true }, { status: 200 });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
