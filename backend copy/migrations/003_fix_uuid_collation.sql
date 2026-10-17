-- Sửa lỗi ER_CANT_AGGREGATE_2COLLATIONS khi JOIN users.company_group_id với company_groups.id
-- (bảng 002 tạo với utf8mb4_0900_ai_ci, schema gốc dùng utf8mb4_general_ci / utf8mb4_bin cho UUID)

ALTER TABLE `company_groups`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `company_groups`
  MODIFY `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

ALTER TABLE `users`
  MODIFY `company_group_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL;

ALTER TABLE `user_email_verifications`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `user_email_verifications`
  MODIFY `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  MODIFY `user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

ALTER TABLE `project_company_groups`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE `project_company_groups`
  MODIFY `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  MODIFY `project_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  MODIFY `company_group_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;
