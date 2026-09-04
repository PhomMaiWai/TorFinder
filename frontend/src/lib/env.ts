const required = {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Check .env.local against .env.example.`
    );
  }
}

export const env = {
  MONGODB_URI: required.MONGODB_URI as string,
  JWT_SECRET: required.JWT_SECRET as string,
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
