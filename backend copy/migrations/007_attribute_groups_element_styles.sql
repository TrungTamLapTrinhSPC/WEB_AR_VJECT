-- Nhóm thuộc tính dự án + màu/opacity cấu kiện

CREATE TABLE IF NOT EXISTS `project_attribute_groups` (
  `id` char(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `color` varchar(7) NOT NULL DEFAULT '#3B82F6',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_project_attribute_groups_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `project_attribute_group_links` (
  `id` char(36) NOT NULL,
  `project_id` char(36) NOT NULL,
  `attribute_group_id` char(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pag_project_group` (`project_id`, `attribute_group_id`),
  KEY `idx_pag_group` (`attribute_group_id`),
  CONSTRAINT `fk_pag_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pag_group` FOREIGN KEY (`attribute_group_id`) REFERENCES `project_attribute_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS `bim_element_styles` (
  `id` char(36) NOT NULL,
  `model_id` char(36) NOT NULL,
  `element_guid` varchar(255) NOT NULL,
  `color_hex` varchar(7) NOT NULL DEFAULT '#3B82F6',
  `opacity_pct` tinyint unsigned NOT NULL DEFAULT 100,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_element_style` (`model_id`, `element_guid`),
  KEY `idx_element_style_model` (`model_id`),
  CONSTRAINT `fk_element_style_model` FOREIGN KEY (`model_id`) REFERENCES `bim_models` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
