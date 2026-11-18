import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile as Upload,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Response } from "express";

import { OrgGuard } from "../common/org.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { MAX_STORED_FILE_BYTES, UploadedFile, downloadHeaders } from "../common/stored-files";
import { PastProjectDto, TeamMemberDto } from "./dto/library.dto";
import { LIBRARY_KINDS, LibraryKind } from "./library.types";
import { LibraryService } from "./library.service";

/** ":kind" is "projects" or "team"; anything else is a route that doesn't exist. */
function kindOf(kind: string): LibraryKind {
  // Own keys only: `in` would also accept "constructor" or "__proto__".
  if (!Object.hasOwn(LIBRARY_KINDS, kind)) throw new NotFoundException();
  return kind as LibraryKind;
}

/**
 * The body is validated per kind here, because one route serves both and the
 * global pipe can't know which DTO applies until the path is read.
 */
async function dtoOf(kind: LibraryKind, body: unknown): Promise<PastProjectDto | TeamMemberDto> {
  const plain = (body && typeof body === "object" ? body : {}) as object;
  const dto: PastProjectDto | TeamMemberDto =
    kind === "projects" ? plainToInstance(PastProjectDto, plain) : plainToInstance(TeamMemberDto, plain);
  const errors = await validate(dto, { whitelist: true });
  if (errors.length) {
    throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
  }
  return dto;
}

/**
 * The signed-in company's proposal library (#259): past projects and team
 * members with their files, and what the library covers of a given TOR.
 * Company accounts only.
 */
@Controller("library")
@UseGuards(OrgGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.library.list(request.session.sub);
  }

  @Get("coverage/:torId")
  coverage(@Req() request: AuthenticatedRequest, @Param("torId") torId: string) {
    return this.library.coverage(request.session.sub, torId);
  }

  @Get("starter-pack/:torId")
  async starterPack(@Req() request: AuthenticatedRequest, @Param("torId") torId: string, @Res() response: Response) {
    const { name, zip } = await this.library.starterPack(request.session.sub, torId);
    response.set({
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    response.end(zip);
  }

  @Post(":kind")
  async create(@Req() request: AuthenticatedRequest, @Param("kind") kind: string, @Body() body: unknown) {
    const which = kindOf(kind);
    return this.library.create(request.session.sub, which, await dtoOf(which, body));
  }

  @Put(":kind/:id")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const which = kindOf(kind);
    return this.library.update(request.session.sub, which, id, await dtoOf(which, body));
  }

  @Delete(":kind/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() request: AuthenticatedRequest, @Param("kind") kind: string, @Param("id") id: string) {
    return this.library.remove(request.session.sub, kindOf(kind), id);
  }

  /** Held in memory, never written to disk: checked, then streamed into GridFS. */
  @Put(":kind/:id/file")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_STORED_FILE_BYTES, files: 1, fields: 0 },
      // Browsers send the filename as UTF-8; multer's latin1 default garbles Thai names.
      defParamCharset: "utf8",
    }),
  )
  attachFile(
    @Req() request: AuthenticatedRequest,
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Upload() file: UploadedFile | undefined,
  ) {
    return this.library.attachFile(request.session.sub, kindOf(kind), id, file);
  }

  @Delete(":kind/:id/file")
  removeFile(@Req() request: AuthenticatedRequest, @Param("kind") kind: string, @Param("id") id: string) {
    return this.library.removeFile(request.session.sub, kindOf(kind), id);
  }

  /** Always a download, never rendered inline. */
  @Get(":kind/:id/file")
  async download(
    @Req() request: AuthenticatedRequest,
    @Param("kind") kind: string,
    @Param("id") id: string,
    @Res() response: Response,
  ) {
    const { file, stream } = await this.library.openFile(request.session.sub, kindOf(kind), id);
    response.set(downloadHeaders(file));
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  }
}
