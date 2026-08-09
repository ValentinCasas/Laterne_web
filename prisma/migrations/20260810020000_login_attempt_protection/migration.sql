CREATE TABLE `loginattempt` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `emailHash` VARCHAR(64) NOT NULL,
  `ipHash` VARCHAR(64) NOT NULL,
  `successful` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `loginattempt_emailHash_createdAt_idx` (`emailHash`, `createdAt`),
  INDEX `loginattempt_ipHash_createdAt_idx` (`ipHash`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
