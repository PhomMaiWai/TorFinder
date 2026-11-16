import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { EmailOnlyDto, ResetPasswordDto, VerifyEmailDto } from "./dto/account-links.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
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

  /** Revokes the caller's session token so it can't be replayed after logout (ASVS 7.4.1). */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(@Req() request: AuthenticatedRequest) {
    await this.authService.logout(request.session.sub);
    return { ok: true as const };
  }

  /** A signed-in user changes their own password (ASVS 6.2.2 / 6.2.3); every session ends, this one included. */
  @Post("password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  changePassword(@Req() request: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(request.session.sub, dto);
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
