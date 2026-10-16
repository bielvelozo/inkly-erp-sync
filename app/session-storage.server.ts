import type { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// PrismaSessionStorage queries the database in its constructor, and Workers forbid I/O in the
// global scope where shopifyApp() is configured; creating it on first use moves that into a request.
export class LazyPrismaSessionStorage implements SessionStorage {
  private storage?: PrismaSessionStorage<typeof prisma>;

  private get inner() {
    this.storage ??= new PrismaSessionStorage(prisma);
    return this.storage;
  }

  storeSession(session: Session) {
    return this.inner.storeSession(session);
  }

  loadSession(id: string) {
    return this.inner.loadSession(id);
  }

  deleteSession(id: string) {
    return this.inner.deleteSession(id);
  }

  deleteSessions(ids: string[]) {
    return this.inner.deleteSessions(ids);
  }

  findSessionsByShop(shop: string) {
    return this.inner.findSessionsByShop(shop);
  }
}
