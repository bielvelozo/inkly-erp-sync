import { env } from "cloudflare:workers";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaD1(env.DB) });

export default prisma;
