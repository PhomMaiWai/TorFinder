import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Ip, Param, Post, Req, UseGuards } from "@nestjs/common";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { Throttle } from "@nestjs/throttler";

import { FormTiming, FormTimingGuard } from "../common/form-timing.guard";
import { AuthenticatedRequest, SessionGuard } from "../common/session.guard";
import { env } from "../config/env";
import { AuthService } from "./auth.service";
import { ClientDevice } from "./known-devices";
import { EmailOnlyDto, ResetPasswordDto, VerifyEmailDto } from "./dto/account-links.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { EndSessionsDto } from "./dto/end-sessions.dto";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { GoogleCompleteSignupDto } from "./dto/google-complete-signup.dto";
import { LoginDto } from "./dto/login.dto";
import { AddPasskeyDto, PasskeyResponseDto } from "./dto/passkey.dto";
import { PasskeysService } from "./passkeys.service";
import { SignupDto } from "./dto/signup.dto";

/**
 * The browser a sign-in came from, as the frontend relays it (ASVS 6.3.5):
 * its device cookie and its own user agent (the frontend's fetch has another).
 */
const clientDevice = (id: string | undefined, userAgent: string | undefined): ClientDevice => ({
  id,
  userAgent: userAgent?.slice(0, 512),
});

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passkeys: PasskeysService,
  ) {}

  @Post("signup")
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  @FormTiming("signup")
  @UseGuards(FormTimingGuard)
  signup(@Body() dto: SignupDto, @Ip() ip: string) {
    return this.authService.signup(dto, ip);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers("x-device-id") deviceId?: string,
    @Headers("x-client-user-agent") userAgent?: string,
  ) {
    return this.authService.login(dto, ip, clientDevice(deviceId, userAgent));
  }

  /** Revokes the caller's session token so it can't be replayed after logout (ASVS 7.4.1). */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(@Req() request: AuthenticatedRequest, @Ip() ip: string) {
    await this.authService.logout(request.session.sub, ip);
    return { ok: true as const };
  }

  /** A signed-in user changes their own password (ASVS 6.2.2 / 6.2.3); every session ends, this one included. */
  @Post("password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  changePassword(@Req() request: AuthenticatedRequest, @Body() dto: ChangePasswordDto, @Ip() ip: string) {
    return this.authService.changePassword(request.session.sub, dto, ip);
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  googleAuth(
    @Body() dto: GoogleAuthDto,
    @Ip() ip: string,
    @Headers("x-device-id") deviceId?: string,
    @Headers("x-client-user-agent") userAgent?: string,
  ) {
    return this.authService.googleAuth(dto, ip, clientDevice(deviceId, userAgent));
  }

  @Post("password/forgot")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  forgotPassword(@Body() dto: EmailOnlyDto, @Ip() ip: string) {
    return this.authService.forgotPassword(dto, ip);
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
    return this.authService.resetPassword(dto, ip);
  }

  @Post("email/verify")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  verifyEmail(@Body() dto: VerifyEmailDto, @Ip() ip: string) {
    return this.authService.verifyEmail(dto, ip);
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
  googleCompleteSignup(
    @Body() dto: GoogleCompleteSignupDto,
    @Ip() ip: string,
    @Headers("x-device-id") deviceId?: string,
    @Headers("x-client-user-agent") userAgent?: string,
  ) {
    return this.authService.googleCompleteSignup(dto, ip, clientDevice(deviceId, userAgent));
  }

  // ---- passkeys (staff; see PasskeysService) ----------------------------

  /** Step two of a staff sign-in: the passkey's answer to the challenge /auth/login or /auth/google returned. */
  @Post("passkey/login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  passkeyLogin(
    @Body() dto: PasskeyResponseDto,
    @Ip() ip: string,
    @Headers("x-device-id") deviceId?: string,
    @Headers("x-client-user-agent") userAgent?: string,
  ) {
    return this.authService.completePasskeyLogin(
      dto.response as unknown as AuthenticationResponseJSON,
      ip,
      clientDevice(deviceId, userAgent),
    );
  }

  // ---- the account's own sessions (ASVS 7.5.2) ------------------------------

  /**
   * 204 while this session is open, 401 once it was ended anywhere (logout,
   * another device, an admin, a password change). The frontend asks on each
   * page, so an ended session is sent to sign-in rather than kept on pages
   * whose data the backend already refuses (ASVS 7.4.1).
   */
  @Get("session")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  checkSession(): void {}

  @Get("sessions")
  @UseGuards(SessionGuard)
  listSessions(@Req() request: AuthenticatedRequest) {
    return this.authService.listSessions(request.session);
  }

  /** Ends all of this account's sessions except the one asking. */
  @Post("sessions/end-others")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  endOtherSessions(@Body() dto: EndSessionsDto, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.authService.endSessions(request.session, "others", dto.password, ip);
  }

  @Post("sessions/:id/end")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  endSession(@Param("id") id: string, @Body() dto: EndSessionsDto, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    return this.authService.endSessions(request.session, { sid: id }, dto.password, ip);
  }

  @Get("passkeys")
  @UseGuards(SessionGuard)
  listPasskeys(@Req() request: AuthenticatedRequest) {
    return this.passkeys.list(request.session.sub);
  }

  @Post("passkeys/options")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  passkeyRegistrationOptions(@Req() request: AuthenticatedRequest) {
    return this.passkeys.registrationOptions(request.session);
  }

  /** Saves a new passkey; answers with the list and the session re-signed as passkey-verified. */
  @Post("passkeys")
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  addPasskey(@Req() request: AuthenticatedRequest, @Body() dto: AddPasskeyDto, @Ip() ip: string) {
    return this.passkeys.finishRegistration(
      request.session,
      dto.name,
      dto.response as unknown as RegistrationResponseJSON,
      ip,
    );
  }

  @Delete("passkeys/:id")
  @UseGuards(SessionGuard)
  removePasskey(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Ip() ip: string) {
    return this.passkeys.remove(request.session, id.slice(0, 1024), ip);
  }

  /** A fresh passkey check for a sensitive action (ASVS 7.5.3): first the challenge… */
  @Post("step-up/options")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  stepUpOptions(@Req() request: AuthenticatedRequest) {
    return this.passkeys.stepUpOptions(request.session);
  }

  /** …then the answer, for the session re-signed with the check's time. */
  @Post("step-up")
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.authTtlMs } })
  async stepUp(@Req() request: AuthenticatedRequest, @Body() dto: PasskeyResponseDto, @Ip() ip: string) {
    const token = await this.passkeys.finishStepUp(
      request.session,
      dto.response as unknown as AuthenticationResponseJSON,
      ip,
    );
    return { token };
  }
}
