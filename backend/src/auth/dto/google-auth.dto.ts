import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @MinLength(1, { message: "credential is required" })
  credential!: string;

  /**
   * "viewer" signs a member of the public straight in, creating the account
   * on first use. Absent means the company flow: an unknown identity is asked
   * for company info and waits for approval.
   */
  @IsOptional()
  @IsIn(["viewer"])
  as?: "viewer";
}
