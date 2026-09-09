import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";

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

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.torService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTorDto) {
    return this.torService.update(id, dto);
  }
}
