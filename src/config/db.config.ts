import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import logger from "./logs.config.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const _prisma = new PrismaClient({ adapter });

async function createPrismaClient(
  retries = 5,
  delay = 5000,
): Promise<PrismaClient> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = new PrismaClient({ adapter });
      await client.$connect();
      logger.info("Connected to Database.");
      return client;
    } catch (err) {
      logger.error(`Attempt ${attempt} failed: ${(err as Error).message}`);
      if (attempt === retries) {
        logger.error("All attempts failed. Exiting.");
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("Unreachable");
}

const prisma = await createPrismaClient();

export default prisma;
