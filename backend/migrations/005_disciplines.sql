-- Bộ môn BIM: bảng `disciplines` + `bim_models.discipline_id`
-- Chạy trên MySQL/MariaDB (vjectar). Bỏ qua lỗi duplicate nếu đã áp dụng một phần.

CREATE TABLE IF NOT EXISTS `disciplines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `disciplines_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `disciplines` (`code`, `name`, `description`, `created_at`, `updated_at`)
SELECT 'architecture', 'Kiến trúc', 'Bộ môn Kiến trúc', NOW(), NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `disciplines` WHERE `code` = 'architecture');

INSERT INTO `disciplines` (`code`, `name`, `description`, `created_at`, `updated_at`)
SELECT 'structure', 'Kết cấu', 'Bộ môn Kết cấu', NOW(), NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `disciplines` WHERE `code` = 'structure');

INSERT INTO `disciplines` (`code`, `name`, `description`, `created_at`, `updated_at`)
SELECT 'plumbing', 'Cấp thoát nước', 'Bộ môn Cấp thoát nước', NOW(), NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `disciplines` WHERE `code` = 'plumbing');

INSERT INTO `disciplines` (`code`, `name`, `description`, `created_at`, `updated_at`)
SELECT 'electrical', 'Điện', 'Bộ môn Điện', NOW(), NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `disciplines` WHERE `code` = 'electrical');

INSERT INTO `disciplines` (`code`, `name`, `description`, `created_at`, `updated_at`)
SELECT 'hvac', 'Thông gió - Điều hòa', 'Bộ môn HVAC & Thông gió', NOW(), NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `disciplines` WHERE `code` = 'hvac');

INSERT INTO `disciplines` (`code`, `name`, `description`, `created_at`, `updated_at`)
SELECT 'other', 'Khác', 'Bộ môn Khác', NOW(), NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `disciplines` WHERE `code` = 'other');

-- Thêm cột discipline_id (chạy một lần; bỏ qua nếu Duplicate column)
ALTER TABLE `bim_models`
  ADD COLUMN `discipline_id` int DEFAULT NULL AFTER `name`;

UPDATE `bim_models` b
LEFT JOIN `disciplines` d ON d.`code` = (
  CASE LOWER(TRIM(b.`discipline`))
    WHEN 'architectural' THEN 'architecture'
    WHEN 'arch' THEN 'architecture'
    WHEN 'structural' THEN 'structure'
    WHEN 'struct' THEN 'structure'
    WHEN 'mep' THEN 'hvac'
    WHEN 'water' THEN 'plumbing'
    WHEN 'electric' THEN 'electrical'
    ELSE LOWER(TRIM(b.`discipline`))
  END
)
SET b.`discipline_id` = COALESCE(d.`id`, (SELECT `id` FROM `disciplines` WHERE `code` = 'other' LIMIT 1))
WHERE b.`discipline_id` IS NULL;

UPDATE `bim_models`
SET `discipline_id` = (SELECT `id` FROM `disciplines` WHERE `code` = 'other' LIMIT 1)
WHERE `discipline_id` IS NULL;

ALTER TABLE `bim_models`
  MODIFY COLUMN `discipline_id` int NOT NULL;

ALTER TABLE `bim_models`
  DROP COLUMN `discipline`;

ALTER TABLE `bim_models`
  ADD KEY `idx_bim_models_discipline` (`discipline_id`);

ALTER TABLE `bim_models`
  ADD CONSTRAINT `fk_bim_models_discipline`
  FOREIGN KEY (`discipline_id`) REFERENCES `disciplines` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
