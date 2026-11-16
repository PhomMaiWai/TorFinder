/**
 * The address a password sign-up used, kept for the "check your inbox" page
 * that follows so it doesn't have to ride in the URL (ASVS 14.2.1). httpOnly,
 * scoped to that page, and gone after half an hour.
 */
export const SIGNUP_EMAIL_COOKIE = "torr_signup_email";

export const signupEmailCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/signup/pending",
  maxAge: 30 * 60,
};
