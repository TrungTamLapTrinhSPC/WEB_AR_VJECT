-- Chạy trên DB vjectar (RDS). Bỏ qua dòng đã tồn tại nếu báo duplicate column.

CREATE TABLE IF NOT EXISTS `company_groups` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_groups_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `user_email_verifications` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `code` varchar(8) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_email_verifications_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `project_company_groups` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `project_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `company_group_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_company_groups_uniq` (`project_id`, `company_group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `users`
  ADD COLUMN `company_group_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL AFTER `language`,
  ADD COLUMN `email_verified_at` datetime DEFAULT NULL AFTER `company_group_id`,
  ADD COLUMN `can_assign_engineers` tinyint(1) NOT NULL DEFAULT 0 AFTER `email_verified_at`;

-- Tài khoản seed / admin tạo sẵn: coi như đã xác minh
UPDATE `users` SET `email_verified_at` = COALESCE(`email_verified_at`, NOW()) WHERE `email_verified_at` IS NULL;
