import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
