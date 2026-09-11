-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Máy chủ: 127.0.0.1
-- Thời gian đã tạo: Th8 24, 2026 lúc 09:57 AM
-- Phiên bản máy phục vụ: 10.4.32-MariaDB
-- Phiên bản PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `vject_ar`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `bim_models`
--

CREATE TABLE `bim_models` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `project_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `version` varchar(255) NOT NULL,
  `model_files` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`model_files`)),
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `metadata_url` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `discipline` varchar(255) NOT NULL DEFAULT 'other',
  `uploaded_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `bim_models`
--

INSERT INTO `bim_models` (`id`, `project_id`, `version`, `model_files`, `metadata`, `metadata_url`, `name`, `discipline`, `uploaded_at`, `created_at`, `updated_at`, `deleted_at`) VALUES
('4a509ea2-8cfc-4fe0-916a-4db21c79601b', '1f9499e8-6e56-40fa-b579-00e99f26321f', 'v1.0.0', '{\"asset_bundle_url\":\"https://cdn.pa3.com/bundles/landmark_pa3_v1.unity3d\",\"usdz_url\":null}', '{\"total_pipes\":120,\"mep_system\":\"HVAC & Plumbing\",\"author\":\"Revit Master\"}', NULL, NULL, 'other', '2026-08-20 10:19:29', '2026-08-20 10:19:29', '2026-08-20 10:19:29', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `feedbacks`
--

CREATE TABLE `feedbacks` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `models_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text NOT NULL,
  `priority` varchar(50) DEFAULT 'normal',
  `element_guid` varchar(255) DEFAULT NULL,
  `bcf_viewpoint` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`bcf_viewpoint`)),
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `location_type` enum('qr','gps') NOT NULL,
  `marker_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(10,8) DEFAULT NULL,
  `status` enum('pending','approved','rejected','open','in_progress','resolved') DEFAULT 'pending',
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `feedbacks`
--

INSERT INTO `feedbacks` (`id`, `user_id`, `models_id`, `title`, `content`, `priority`, `element_guid`, `bcf_viewpoint`, `images`, `location_type`, `marker_id`, `lat`, `lng`, `status`, `synced_at`, `created_at`, `updated_at`, `deleted_at`) VALUES
('15e5416b-e866-44ed-9961-5a6451344291', '1b71e54c-a3af-494b-8a0c-24baad2b190b', NULL, 'Ống nước MEP đâm xuyên dầm kết cấu A12', 'Xung đột giữa hệ thống ống Plumbing và Dầm bê tông tầng 2.', 'high', '1A2B3C4D-5E6F-7G8H-9I0J-K1L2M3N4O5P6', '{\"viewpoint_guid\":\"a4120405-fb29-45bf-a9ae-8e1ba1dc1dc8\",\"camera_position\":[12.5,2,4.8],\"camera_direction\":[0.707,0,-0.707],\"camera_up_vector\":[0,1,0],\"snapshot_url\":\"https://cdn.pa3.com/bcf/snapshots/issue_001.jpg\",\"selection\":[{\"ifc_guid\":\"1A2B3C4D-5E6F-7G8H-9I0J-K1L2M3N4O5P6\"}]}', '[\"https://cdn.pa3.com/bcf/snapshots/issue_001.jpg\"]', 'gps', NULL, NULL, NULL, 'open', '2026-08-20 10:22:49', '2026-08-20 10:22:49', '2026-08-20 10:22:49', NULL),
('3eb11158-90e3-4bb9-88e4-a92fcbd3526e', '1b71e54c-a3af-494b-8a0c-24baad2b190b', NULL, 'Ống nước MEP đâm xuyên dầm kết cấu A12', 'Xung đột giữa hệ thống ống Plumbing và Dầm bê tông tầng 2.', 'high', '1A2B3C4D-5E6F-7G8H-9I0J-K1L2M3N4O5P6', '{\"viewpoint_guid\":\"f249ca87-6d7a-48c2-9c87-470304ef5796\",\"camera_position\":[12.5,2,4.8],\"camera_direction\":[0.707,0,-0.707],\"camera_up_vector\":[0,1,0],\"snapshot_url\":\"https://cdn.pa3.com/bcf/snapshots/issue_001.jpg\",\"selection\":[{\"ifc_guid\":\"1A2B3C4D-5E6F-7G8H-9I0J-K1L2M3N4O5P6\"}]}', '[\"https://cdn.pa3.com/bcf/snapshots/issue_001.jpg\"]', 'gps', NULL, NULL, NULL, 'open', '2026-08-20 10:22:24', '2026-08-20 10:22:24', '2026-08-20 10:22:24', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `gps_pois`
--

CREATE TABLE `gps_pois` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `model_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('manhole','pipe_junction','valve','cable_box') NOT NULL,
  `lat_wgs84` decimal(10,8) NOT NULL,
  `lng_wgs84` decimal(10,8) NOT NULL,
  `elevation` float DEFAULT NULL,
  `depth` float DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `gps_pois`
--

INSERT INTO `gps_pois` (`id`, `model_id`, `name`, `type`, `lat_wgs84`, `lng_wgs84`, `elevation`, `depth`, `created_at`, `updated_at`, `deleted_at`) VALUES
('08a75d1a-144c-4920-aa26-b46ba05e035c', '4a509ea2-8cfc-4fe0-916a-4db21c79601b', 'Hố ga kỹ thuật #05', 'manhole', 21.02851120, 99.99999999, 15.2, 1.5, '2026-08-20 10:19:29', '2026-08-20 10:19:29', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `projects`
--

CREATE TABLE `projects` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `status` enum('active','completed','archived') DEFAULT 'active',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `projects`
--

INSERT INTO `projects` (`id`, `name`, `address`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
('1f9499e8-6e56-40fa-b579-00e99f26321f', 'Tòa nhà Landmark PA3', 'Số 1 Đường AR/BIM, Hà Nội', 'active', '2026-08-20 10:19:29', '2026-08-20 10:19:29', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `project_users`
--

CREATE TABLE `project_users` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `project_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `project_users`
--

INSERT INTO `project_users` (`id`, `project_id`, `user_id`, `created_at`, `updated_at`) VALUES
('e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', '1f9499e8-6e56-40fa-b579-00e99f26321f', '88eb9219-ff0b-4b5a-9696-6d1808b39e33', '2026-08-21 09:00:00', '2026-08-21 09:00:00');

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `qr_markers`
--

CREATE TABLE `qr_markers` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `marker_code` varchar(255) NOT NULL,
  `project_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `floor_level` varchar(255) DEFAULT NULL,
  `physical_width_m` float NOT NULL DEFAULT 0.15,
  `bim_pos_x` float NOT NULL DEFAULT 0,
  `bim_pos_y` float NOT NULL DEFAULT 0,
  `bim_pos_z` float NOT NULL DEFAULT 0,
  `bim_rot_pitch` float NOT NULL DEFAULT 0,
  `bim_rot_yaw` float NOT NULL DEFAULT 0,
  `bim_rot_roll` float NOT NULL DEFAULT 0,
  `surface_type` varchar(20) DEFAULT 'COLUMN',
  `qr_image_url` varchar(512) DEFAULT NULL,
  `affine_matrix` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`affine_matrix`)),
  `position_x` float DEFAULT NULL,
  `position_y` float DEFAULT NULL,
  `position_z` float DEFAULT NULL,
  `rotation_y` float DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `qr_markers`
--

INSERT INTO `qr_markers` (`id`, `marker_code`, `project_id`, `floor_level`, `physical_width_m`, `bim_pos_x`, `bim_pos_y`, `bim_pos_z`, `bim_rot_pitch`, `bim_rot_yaw`, `bim_rot_roll`, `surface_type`, `qr_image_url`, `affine_matrix`, `position_x`, `position_y`, `position_z`, `rotation_y`, `created_at`, `updated_at`, `deleted_at`) VALUES
('b0938582-bcf4-4c37-b79a-b0880ce291a5', 'PA3-HN1-F2-05', '1f9499e8-6e56-40fa-b579-00e99f26321f', 'Tầng 2', 0.15, 12.65, 2, 4.74, 0, 49.5, 0, 'COLUMN', 'https://cdn.pa3.com/qr/PA3-HN1-F2-05.png', '[0.6494480483301835,0,-0.760405965600031,0,0,1,0,0,0.760405965600031,0,0.6494480483301835,0,12.65,2,4.74,1]', 12.65, 2, 4.74, 49.5, '2026-08-20 10:19:29', '2026-08-20 10:22:49', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `users`
--

CREATE TABLE `users` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `role` enum('admin','bql','engineer') DEFAULT 'engineer',
  `language` enum('vi','en','ja') DEFAULT 'vi',
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Đang đổ dữ liệu cho bảng `users`
--

INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `role`, `language`, `created_at`, `updated_at`, `deleted_at`) VALUES
('1b71e54c-a3af-494b-8a0c-24baad2b190b', 'admin@pa3.com', '$2a$10$R4vU0b2h4ChiEbxVh8DkXucQC2xh4oGE8/HxHUQAWjhL6Jmj7DDpW', 'System Admin', 'admin', 'vi', '2026-08-20 10:19:29', '2026-08-20 10:19:29', NULL),
('88eb9219-ff0b-4b5a-9696-6d1808b39e33', 'engineer@pa3.com', '$2a$10$R4vU0b2h4ChiEbxVh8DkXucQC2xh4oGE8/HxHUQAWjhL6Jmj7DDpW', 'Nguyen Van Kysu', 'engineer', 'vi', '2026-08-20 10:19:29', '2026-08-20 10:19:29', NULL),
('fa6f9998-bfab-4c40-ad54-188dade27906', 'tanhls1@gmail.com', '$2a$10$r9gf/o41FZgHgAaRLdKTj.9PjJRa49EB7friuxG7zpUNXI3XPG0bq', 'Kiều Tuấn Anh', 'admin', 'vi', '2026-08-21 02:47:24', '2026-08-21 02:47:24', NULL);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `expires_at` datetime NOT NULL,
  `refresh_expires_at` datetime NOT NULL,
  `device_info` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `bim_models`
--
ALTER TABLE `bim_models`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- Chỉ mục cho bảng `feedbacks`
--
ALTER TABLE `feedbacks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_feedbacks_models_id` (`models_id`);

--
-- Chỉ mục cho bảng `gps_pois`
--
ALTER TABLE `gps_pois`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`model_id`),
  ADD KEY `idx_gps_pois_model_id` (`model_id`);

--
-- Chỉ mục cho bảng `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`);

--
-- Chỉ mục cho bảng `project_users`
--
ALTER TABLE `project_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_project_user` (`project_id`,`user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Chỉ mục cho bảng `qr_markers`
--
ALTER TABLE `qr_markers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `marker_code` (`marker_code`),
  ADD KEY `project_id` (`project_id`);

--
-- Chỉ mục cho bảng `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Chỉ mục cho bảng `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_sessions_user_id` (`user_id`),
  ADD KEY `idx_user_sessions_expires_at` (`expires_at`),
  ADD KEY `idx_user_sessions_refresh_expires_at` (`refresh_expires_at`);

--
-- Các ràng buộc cho các bảng đã đổ
--

--
-- Các ràng buộc cho bảng `bim_models`
--
ALTER TABLE `bim_models`
  ADD CONSTRAINT `bim_models_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Các ràng buộc cho bảng `feedbacks`
--
ALTER TABLE `feedbacks`
  ADD CONSTRAINT `feedbacks_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_feedbacks_models_id` FOREIGN KEY (`models_id`) REFERENCES `bim_models` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Các ràng buộc cho bảng `gps_pois`
--
ALTER TABLE `gps_pois`
  ADD CONSTRAINT `fk_gps_pois_model_id` FOREIGN KEY (`model_id`) REFERENCES `bim_models` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Các ràng buộc cho bảng `project_users`
--
ALTER TABLE `project_users`
  ADD CONSTRAINT `project_users_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `project_users_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Các ràng buộc cho bảng `qr_markers`
--
ALTER TABLE `qr_markers`
  ADD CONSTRAINT `qr_markers_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Các ràng buộc cho bảng `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `fk_user_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
