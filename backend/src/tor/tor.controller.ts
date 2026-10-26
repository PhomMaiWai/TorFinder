import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { AdminGuard } from "../common/admin.guard";
import { AuthenticatedRequest } from "../common/session.guard";
import { CreateTorDto } from "./dto/create-tor.dto";
import { ListTorQueryDto } from "./dto/list-tor-query.dto";
import { UpdateTorDto } from "./dto/update-tor.dto";
import { TorArchiveService } from "./tor-archive.service";
import { TorDocumentService } from "./tor-document.service";
import { TorService } from "./tor.service";

@Controller("tor")
export class TorController {
  constructor(
    private readonly torService: TorService,
    private readonly documents: TorDocumentService,
    private readonly archives: TorArchiveService,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateTorDto) {
    return this.torService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListTorQueryDto) {
    return this.torService.findAll(query.page, query.pageSize, query.source);
  }

  /**
   * What has been hidden, so it can be restored. Admin-only and declared before
   * `:id` — otherwise Nest would read "deleted" as an announcement id.
   */
  @Get("deleted")
  @UseGuards(AdminGuard)
  findDeleted() {
    return this.torService.findDeleted();
  }

  /**
   * One of the announcement's files, as a PDF or image the browser can show inline.
   * `?download=1` asks for a save dialog instead. Public, like the record.
   */
  /** The PDFs and images inside a zipped bundle the announcement links to. */
  @Get(":id/documents/:index/entries")
  archiveEntries(@Param("id") id: string, @Param("index", ParseIntPipe) index: number) {
    return this.archives.entries(id, index);
  }

  /** One file out of that bundle, inline; `?download=1` for a save dialog. */
  @Get(":id/documents/:index/entries/:entry")
  async archiveEntry(
    @Param("id") id: string,
    @Param("index", ParseIntPipe) index: number,
    @Param("entry", ParseIntPipe) entry: number,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.archives.file(id, index, entry);
    res
      .set({
        "Content-Type": file.contentType,
        "Content-Length": String(file.data.byteLength),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "Cache-Control": "public, max-age=86400, immutable",
      })
      .end(file.data);
  }

  @Get(":id/documents/:index")
  async document(
    @Param("id") id: string,
    @Param("index", ParseIntPipe) index: number,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const reader = new AbortController();
    res.on("close", () => reader.abort());

    const file = await this.documents.open(id, index, reader.signal);
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      // An announcement's file never changes once published.
      "Cache-Control": "public, max-age=86400, immutable",
      ...(file.length ? { "Content-Length": String(file.length) } : {}),
    });
    file.body.on("error", () => res.destroy()).pipe(res);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.torService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  update(@Param("id") id: string, @Body() dto: UpdateTorDto) {
    return this.torService.update(id, dto);
  }

  /**
   * Hiding a public procurement notice is privileged, so it takes an admin
   * session — a vendor account must not be able to remove announcements other
   * vendors are reading.
   */
  @Delete(":id")
  @UseGuards(AdminGuard)
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.torService.softDelete(id, request.session.email);
  }

  @Post(":id/restore")
  @UseGuards(AdminGuard)
  restore(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.torService.restore(id, request.session.email);
  }
}
