-- AlterTable
ALTER TABLE `Order` ADD COLUMN `discountAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `discountType` VARCHAR(191) NULL;
