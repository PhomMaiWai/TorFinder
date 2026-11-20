const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * The address a password sign-up used, kept for the "check your inbox" page
 * that follows so it doesn't have to ride in the URL (ASVS 14.2.1). httpOnly
 * and gone after half an hour. In production it has the `__Host-` prefix
 * (ASVS 3.3.3), which needs `Path=/`: no other host can set or overwrite it.
 */
export const SIGNUP_EMAIL_COOKIE = IS_PRODUCTION ? "__Host-torr_signup_email" : "torr_signup_email";

export const signupEmailCookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 60,
};
