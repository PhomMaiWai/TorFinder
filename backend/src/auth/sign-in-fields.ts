/**
 * What sign-in, password change and passkey code read from an account (ASVS
 * 11.7.2): who it is, whether it may sign in, and its own credentials. A
 * company's profile (contacts, team CVs, past projects, certificates) and its
 * notification settings stay in the database; only the company's name is
 * read, for the "waiting for approval" answer.
 */
export const SIGN_IN_FIELDS = {
  email: 1,
  name: 1,
  role: 1,
  status: 1,
  suspended: 1,
  createdAt: 1,
  passwordHash: 1,
  passwordSalt: 1,
  passwordParams: 1,
  googleId: 1,
  emailVerified: 1,
  passkeys: 1,
  knownDevices: 1,
  "company.companyName": 1,
} as const;
