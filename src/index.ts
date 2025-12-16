import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const _prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Connected");
  try {
    const client = new PrismaClient({ adapter });
    await client.$connect();
    console.log("Connected to Database.");
    return client;
  } catch (err) {
    console.error(`Unable to connect to database cause of ${err}`);
  }
}

main();
