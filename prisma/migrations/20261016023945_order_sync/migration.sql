-- CreateTable
CREATE TABLE "OrderSync" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "orderCreatedAt" DATETIME NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "webhookDeliveries" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "erpNumber" TEXT,
    "trackingNumber" TEXT,
    "trackingCompany" TEXT,
    "trackingUrl" TEXT,
    "fulfillmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderSyncId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncEvent_orderSyncId_fkey" FOREIGN KEY ("orderSyncId") REFERENCES "OrderSync" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErpOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idempotencyKey" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "trackingNumber" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" DATETIME,
    "notifiedAt" DATETIME,
    "notifyError" TEXT
);

-- CreateTable
CREATE TABLE "ErpSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "offline" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "OrderSync_shop_createdAt_idx" ON "OrderSync"("shop", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderSync_shop_orderId_key" ON "OrderSync"("shop", "orderId");

-- CreateIndex
CREATE INDEX "SyncEvent_orderSyncId_createdAt_idx" ON "SyncEvent"("orderSyncId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ErpOrder_idempotencyKey_key" ON "ErpOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ErpOrder_shop_receivedAt_idx" ON "ErpOrder"("shop", "receivedAt");
