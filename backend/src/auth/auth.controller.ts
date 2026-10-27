import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { EmailOnlyDto, ResetPasswordDto, VerifyEmailDto } from "./dto/account-links.dto";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { GoogleCompleteSignupDto } from "./dto/google-complete-signup.dto";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  @Post("password/forgot")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  forgotPassword(@Body() dto: EmailOnlyDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("email/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post("email/resend")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  resendVerification(@Body() dto: EmailOnlyDto) {
    return this.authService.resendVerification(dto);
  }

  @Post("google/complete")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  googleCompleteSignup(@Body() dto: GoogleCompleteSignupDto) {
    return this.authService.googleCompleteSignup(dto);
  }
}
