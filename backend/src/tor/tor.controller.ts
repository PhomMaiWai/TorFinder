import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";

import { AdminGuard } from "../common/admin.guard";
import { CreateTorDto } from "./dto/create-tor.dto";
import { ListTorQueryDto } from "./dto/list-tor-query.dto";
import { UpdateTorDto } from "./dto/update-tor.dto";
import { TorService } from "./tor.service";

@Controller("tor")
export class TorController {
  constructor(private readonly torService: TorService) {}

  @Post()
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

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.torService.findOne(id);
  }

  @Patch(":id")
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
  remove(@Param("id") id: string) {
    return this.torService.softDelete(id);
  }

  @Post(":id/restore")
  @UseGuards(AdminGuard)
  restore(@Param("id") id: string) {
    return this.torService.restore(id);
  }
}
