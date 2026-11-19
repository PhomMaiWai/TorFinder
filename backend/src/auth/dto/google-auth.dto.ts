import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @MinLength(1, { message: "credential is required" })
  credential!: string;

  /** The nonce the frontend gave Google for this browser's sign-in, read from its HttpOnly cookie (ASVS 10.1.2). */
  @IsString()
  @MinLength(22, { message: "nonce is required" })
  @MaxLength(128)
  nonce!: string;

  /**
   * "viewer" signs a member of the public straight in, creating the account
   * on first use. Absent means the company flow: an unknown identity is asked
   * for company info and waits for approval.
   */
  @IsOptional()
  @IsIn(["viewer"])
  as?: "viewer";
}
