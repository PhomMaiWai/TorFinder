import { ArrayMaxSize, IsArray, IsString } from "class-validator";

/** A browser's own bookmarks, folded into the account the moment it signs in. */
export class ImportSavedTorsDto {
  @IsArray()
  // Generous for one person's bookmarks; caps how much one request can make us look up.
  @ArrayMaxSize(500)
  @IsString({ each: true })
  torIds!: string[];
}
