-- DropIndex
DROP INDEX `Customer_phone_idx` ON `Customer`;

-- CreateIndex
CREATE UNIQUE INDEX `Customer_phone_key` ON `Customer`(`phone`);
