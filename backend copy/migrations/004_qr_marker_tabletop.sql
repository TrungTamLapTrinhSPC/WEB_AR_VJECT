-- QR marker: field vs tabletop AR + in giấy / offset (đã chạy trên prod nếu user ALTER thủ công)

ALTER TABLE `qr_markers`
  ADD COLUMN `marker_type` ENUM('field', 'tabletop') NOT NULL DEFAULT 'field',
  ADD COLUMN `paper_size` VARCHAR(20) NULL DEFAULT 'A3',
  ADD COLUMN `tabletop_scale` FLOAT NULL DEFAULT 0.01,
  ADD COLUMN `offset_to_center_x` FLOAT NULL DEFAULT 0.15,
  ADD COLUMN `offset_to_center_z` FLOAT NULL DEFAULT -0.10,
  ADD COLUMN `paper_rotation_y` FLOAT NULL DEFAULT 0.0;
