import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { FindSimilarDto } from "./dto/find-similar.dto";
import { SimilarService } from "./similar.service";

@Controller("tor/similar")
export class SimilarController {
  constructor(private readonly similar: SimilarService) {}

  /**
   * Public, like the search page it serves. A POST because the pasted text can
   * run to pages; nothing is stored about the query. Throttled a little tighter
   * than the default, since with Vertex on each call embeds the query.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  find(@Body() dto: FindSimilarDto) {
    return this.similar.findSimilar(dto);
  }
}
