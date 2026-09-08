import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import clientPromise from "@/lib/mongodb";
import type { UserDocument } from "@/types/user";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type SignupBody = {
  email?: string;
  password?: string;
  companyName?: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  address?: string;
  specialty?: string;
  size?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SignupBody;
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const companyName = body.companyName?.trim() ?? "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "กรุณากรอกอีเมลให้ถูกต้อง" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร` },
      { status: 400 }
    );
  }
  if (!companyName) {
    return NextResponse.json({ error: "กรุณากรอกชื่อบริษัท" }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const users = client.db("torfinder").collection<UserDocument>("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await users.insertOne({
      email,
      passwordHash,
      companyName,
      taxId: body.taxId?.trim() ?? "",
      contactName: body.contactName?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
      address: body.address?.trim() ?? "",
      specialty: body.specialty?.trim() ?? "",
      size: body.size?.trim() ?? "",
      status: "pending",
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, companyName }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
