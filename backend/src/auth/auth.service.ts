import { Injectable, UnauthorizedException } from "@nestjs/common";

import { verifyPassword } from "../common/password";
import { createSessionToken } from "../common/token";
import { DatabaseService } from "../database/database.service";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  async login({ email, password }: LoginDto) {
    const user = await this.db.users.findOne({ email: email.trim().toLowerCase() });

    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      throw new UnauthorizedException("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
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
