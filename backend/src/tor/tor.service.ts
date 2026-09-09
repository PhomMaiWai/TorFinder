import { Injectable, NotFoundException } from "@nestjs/common";
import { Filter, ObjectId } from "mongodb";

import { DatabaseService, TorDoc } from "../database/database.service";
import { CreateTorDto } from "./dto/create-tor.dto";
import { TorSource } from "./dto/list-tor-query.dto";
import { UpdateTorDto } from "./dto/update-tor.dto";

@Injectable()
export class TorService {
  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateTorDto) {
    const doc = { ...dto, match: 0, createdAt: new Date() };
    // insertOne mutates what it is given by adding _id — pass a copy so the
    // response keeps exposing only `id`.
    const { insertedId } = await this.db.tors.insertOne({ ...doc });
    return { id: insertedId.toString(), ...doc };
  }

  async findAll(page = 1, pageSize = 20, source?: TorSource) {
    const filter: Filter<TorDoc> = {};
    if (source) filter.sourceRef = { $exists: source === "egp" };

    const docs = await this.db.tors
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  async findOne(id: string) {
    const doc = ObjectId.isValid(id) ? await this.db.tors.findOne({ _id: new ObjectId(id) }) : null;
    if (!doc) throw new NotFoundException("ไม่พบรายการ TOR");
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }

  async update(id: string, dto: UpdateTorDto) {
    if (!ObjectId.isValid(id)) throw new NotFoundException("ไม่พบรายการ TOR");

    // Mongo's driver serializes `undefined` values as null in $set, which would
    // wipe out fields the caller never touched — so only send the ones present.
    const updates = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));

    const result = await this.db.tors.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: "after" },
    );
    if (!result) throw new NotFoundException("ไม่พบรายการ TOR");

    const { _id, ...rest } = result;
    return { id: _id.toString(), ...rest };
  }
}
