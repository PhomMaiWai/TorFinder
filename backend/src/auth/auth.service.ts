import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { MongoServerError } from "mongodb";

import { hashPassword, verifyPassword } from "../common/password";
import { createSessionToken } from "../common/token";
import { DatabaseService } from "../database/database.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";

const DUPLICATE_KEY = 11000;

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async signup({ email, password, ...company }: SignupDto) {
    const { hash, salt } = await hashPassword(password);

    try {
      await this.db.users.insertOne({
        email: email.trim().toLowerCase(),
        name: company.companyName,
        role: "org",
        // Every organization starts pending; an admin decides from /admin/accounts.
        status: "pending",
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date(),
        company,
      });
    } catch (error) {
      // The unique index on email is what actually guards against duplicates —
      // checking first would still race between two concurrent signups.
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) {
        throw new ConflictException("อีเมลนี้ถูกใช้สมัครแล้ว");
      }
      throw error;
    }

    return { status: "pending" as const, companyName: company.companyName };
  }

  async login({ email, password }: LoginDto) {
    const user = await this.db.users.findOne({ email: email.trim().toLowerCase() });

    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      throw new UnauthorizedException("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    // Checked only after the password, so the response can't be used to probe
    // which emails are registered.
    if (user.status === "pending") {
      throw new ForbiddenException("บัญชีของคุณอยู่ระหว่างรอผู้ดูแลระบบตรวจสอบ");
    }
    if (user.status === "rejected") {
      throw new ForbiddenException("บัญชีของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อผู้ดูแลระบบ");
    }

    const token = createSessionToken({
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return {
      user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      token,
    };
  }
}
