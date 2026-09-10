import { IsString, MinLength } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @MinLength(1, { message: "credential is required" })
  credential!: string;
}
