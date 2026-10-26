import { Controller, Get, Param, ParseEnumPipe, ParseIntPipe, Query, Res } from "@nestjs/common";
import type { Response } from "express";

import {
  EGP_BUNDLE_KINDS,
  EGP_FILE_KINDS,
  EgpBundleKind,
  EgpDocumentsService,
  EgpFileKind,
} from "./egp-documents.service";

const FILE_KIND = Object.fromEntries(EGP_FILE_KINDS.map((kind) => [kind, kind]));
const BUNDLE_KIND = Object.fromEntries(EGP_BUNDLE_KINDS.map((kind) => [kind, kind]));

function send(
  res: Response,
  file: { data: Buffer; contentType: string; filename: string },
  download: string | undefined,
): void {
  res
    .set({
      "Content-Type": file.contentType,
      "Content-Length": String(file.data.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      // A published e-GP document doesn't change; let the browser keep it.
      "Cache-Control": "public, max-age=86400",
    })
    .end(file.data);
}

/** Public, like the announcement pages that show these documents. */
@Controller("tor/:id/egp-documents")
export class EgpDocumentsController {
  constructor(private readonly documents: EgpDocumentsService) {}

  @Get()
  list(@Param("id") id: string) {
    return this.documents.list(id);
  }

  /** The files in a bundle; declared before ":kind" so "entries" is never read as a file kind. */
  @Get(":kind/entries")
  entries(@Param("id") id: string, @Param("kind", new ParseEnumPipe(BUNDLE_KIND)) kind: EgpBundleKind) {
    return this.documents.bundleFiles(id, kind);
  }

  @Get(":kind/entries/:entry")
  async entry(
    @Param("id") id: string,
    @Param("kind", new ParseEnumPipe(BUNDLE_KIND)) kind: EgpBundleKind,
    @Param("entry", ParseIntPipe) entry: number,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    send(res, await this.documents.bundleFile(id, kind, entry), download);
  }

  /** A single rendered PDF, inline; `?download=1` for a save dialog. */
  @Get(":kind")
  async file(
    @Param("id") id: string,
    @Param("kind", new ParseEnumPipe(FILE_KIND)) kind: EgpFileKind,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const { pdf, filename } = await this.documents.file(id, kind);
    send(res, { data: pdf, contentType: "application/pdf", filename }, download);
  }
}
