import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";

import { OrgGuard } from "../common/org.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { CERTIFICATE_LIMITS } from "./certificate.types";
import { CertificatesService, UploadedCertificateFile } from "./certificates.service";
import { CertificateDto } from "./dto/certificate.dto";

/**
 * The signed-in company's own certificates. Company accounts only: the
 * records feed its TOR matching and its proposals, and no other role has
 * either.
 */
@Controller("certificates")
@UseGuards(OrgGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return { certificates: await this.certificates.list(request.session.sub) };
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CertificateDto) {
    return this.certificates.create(request.session.sub, dto);
  }

  /** Declared before ":id" so "none" is never read as an id. */
  @Post("none")
  @HttpCode(HttpStatus.OK)
  async answerNone(@Req() request: AuthenticatedRequest) {
    return { certificates: await this.certificates.answerNone(request.session.sub) };
  }

  @Put(":id")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CertificateDto) {
    return this.certificates.update(request.session.sub, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.certificates.remove(request.session.sub, id);
  }

  /** Held in memory, never written to disk: it is checked, then streamed straight into GridFS. */
  @Put(":id/file")
  @UseInterceptors(
    // No storage option: Nest's default keeps the upload in memory.
    FileInterceptor("file", {
      limits: { fileSize: CERTIFICATE_LIMITS.fileBytes, files: 1, fields: 0 },
      // Browsers send the filename as UTF-8; multer's latin1 default garbles Thai names.
      defParamCharset: "utf8",
    }),
  )
  attachFile(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @UploadedFile() file: UploadedCertificateFile | undefined,
  ) {
    return this.certificates.attachFile(request.session.sub, id, file);
  }

  @Delete(":id/file")
  removeFile(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.certificates.removeFile(request.session.sub, id);
  }

  /**
   * Always a download, never rendered inline: an uploaded file must not run
   * in our origin, whatever it claims to be.
   */
  @Get(":id/file")
  async download(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Res() response: Response) {
    const { file, stream } = await this.certificates.openFile(request.session.sub, id);
    response.set({
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${asciiName(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  }
}

/** The plain-ASCII fallback a browser without filename* support shows. */
function asciiName(name: string): string {
  const extension = name.slice(name.lastIndexOf("."));
  const ascii = name.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").trim();
  return ascii.length > extension.length ? ascii : `certificate${extension}`;
}
