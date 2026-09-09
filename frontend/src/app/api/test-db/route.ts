import { NextResponse } from "next/server";

import { getMongoClient } from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await getMongoClient();
    const db = client.db("torfinder");
    const collections = await db.listCollections().toArray();
    return NextResponse.json({ success: true, collections });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
