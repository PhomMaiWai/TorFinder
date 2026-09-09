import { MongoClient } from "mongodb";

const options = {};

// Connecting at module scope would run during `next build` (and throw when
// MONGODB_URI isn't set there), so the client is created on first use instead.
let clientPromise: Promise<MongoClient> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI in .env.local");
  }

  if (process.env.NODE_ENV === "development") {
    // Prevents multiple connections during hot-reload in dev
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };
    globalWithMongo._mongoClientPromise ??= new MongoClient(uri, options).connect();
    return globalWithMongo._mongoClientPromise;
  }

  clientPromise ??= new MongoClient(uri, options).connect();
  return clientPromise;
}
