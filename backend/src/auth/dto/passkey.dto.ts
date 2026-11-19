import { IsNotEmpty, IsObject, IsString, MaxLength } from "class-validator";

/**
 * A browser's WebAuthn answer, passed to @simplewebauthn/server as is: the
 * library checks its structure, signature, origin and challenge, so only the
 * outer shape is validated here.
 */
export class PasskeyResponseDto {
  @IsObject()
  response!: Record<string, unknown>;
}

export class AddPasskeyDto extends PasskeyResponseDto {
  /** The user's label for the device, e.g. "Work laptop". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;
}
