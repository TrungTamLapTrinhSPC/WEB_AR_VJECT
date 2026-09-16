# PA3 Admin Panel — API Specification

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <access_token>`

## Conventions

### Cursor pagination (GET list)

Tất cả endpoint list dùng **cursor-based pagination** (không dùng offset).

**Query params chung:**

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `cursor` | string | — | Cursor từ response trước (`pagination.next_cursor`) |
| `limit` | int | 20 | Số bản ghi/trang (max 100) |
| `sort` | string | `-created_at` | Trường sort; prefix `-` = DESC |

**Response:**

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "has_more": true,
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wOC0yMFQxMDoxOTozMFoiLCJpZCI6IjFmOTQ5OWU4In0="
  }
}
```

Cursor encode: `base64url(JSON({ created_at, id }))` — sort ổn định theo `(created_at DESC, id DESC)`.

### Redis caching

| Loại | TTL | Key pattern |
|------|-----|-------------|
| List (có filter) | 60s | `pa3:{resource}:list:{filterHash}` |
| Detail | 300s | `pa3:{resource}:{id}` |
| Dashboard stats | 120s | `pa3:dashboard:stats` |
| Settings | 600s | `pa3:settings` |

Invalidate cache khi `POST` / `PATCH` / `DELETE` trên resource tương ứng.

### Mapping UI ↔ Database

| UI (Admin Panel) | DB Table | Ghi chú |
|------------------|----------|---------|
| Projects | `projects` + aggregates | UI có `code`, `owner` → cần mở rộng schema hoặc `metadata` JSON |
| BIM Models | `bim_models` | `discipline` ↔ type; `model_files` JSON chứa bundle URL |
| QR Markers | `qr_markers` | UI `status` chưa có trong DB → đề xuất thêm cột |
| GPS POIs | `gps_pois` | `type`: manhole, pipe_junction, valve, cable_box |
| Elements | `bim_models.metadata` | Chưa có bảng riêng; parse từ metadata hoặc phase 2 |
| Feedback | `feedbacks` | Map status: `open`↔`open`, `inprogress`↔`in_progress`, `resolved`↔`resolved` |
| Users | `users` + `project_users` | Role DB: admin, bql, engineer |
| Settings | Redis / `system_settings` | Chưa có bảng — lưu Redis hoặc tạo bảng mới |
| Audit Log | `audit_logs` (phase 2) | Chưa có bảng — middleware ghi log |

---

## 1. Authentication

| Method | Endpoint | Mô tả | Cache |
|--------|----------|-------|-------|
| POST | `/auth/login` | Login email/password → access + refresh token | — |
| POST | `/auth/logout` | Revoke session | — |
| POST | `/auth/refresh` | Refresh access token | — |
| GET | `/auth/me` | Profile user hiện tại | 60s |

**POST `/auth/login`**

```json
// Request
{ "email": "admin@pa3.com", "password": "..." }

// Response
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 86400,
  "user": { "id", "email", "full_name", "role", "language" }
}
```

---

## 2. Dashboard

| Method | Endpoint | UI Screen | Cache |
|--------|----------|-----------|-------|
| GET | `/dashboard/stats` | Dashboard — stat cards | 120s |
| GET | `/dashboard/recent-feedbacks` | Dashboard — feedback gần đây | 60s |
| GET | `/dashboard/recent-bim` | Dashboard — BIM activity | 60s |
| GET | `/dashboard/feedback-trend` | Dashboard — biểu đồ tuần | 300s |
| GET | `/dashboard/priority-distribution` | Dashboard — phân bổ ưu tiên | 300s |
| GET | `/dashboard/user-activity` | Dashboard — hoạt động user | 120s |

**GET `/dashboard/stats`**

```json
{
  "active_projects": 4,
  "bim_models": 12,
  "qr_markers": 225,
  "open_feedbacks": 12,
  "online_engineers": 8,
  "changes": {
    "projects_this_week": 1,
    "bim_this_week": 3,
    "qr_this_week": 12,
    "feedbacks_today": 4
  }
}
```

---

## 3. Projects

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/projects` | Projects list, global search | ✅ cursor |
| GET | `/projects/:id` | Project detail modal | — |
| POST | `/projects` | Tạo dự án mới modal | — |
| PATCH | `/projects/:id` | Sửa dự án | — |
| DELETE | `/projects/:id` | Soft delete | — |
| GET | `/projects/:id/stats` | Project modal — stat cards | 120s |
| GET | `/projects/:id/bim-models` | Project modal — tab BIM | ✅ cursor |
| GET | `/projects/:id/team` | Project modal — tab Team | — |
| POST | `/projects/:id/team` | Gán user vào dự án | — |
| DELETE | `/projects/:id/team/:userId` | Gỡ user khỏi dự án | — |

**GET `/projects` filters:** `search`, `status` (active|completed|archived)

---

## 4. BIM Models

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/bim-models` | BIM page grid | ✅ cursor |
| GET | `/bim-models/:id` | BIM detail modal | — |
| POST | `/bim-models` | Upload BIM modal (metadata + presigned URL) | — |
| PATCH | `/bim-models/:id` | Sửa / activate version | — |
| DELETE | `/bim-models/:id` | Soft delete | — |
| GET | `/bim-models/:id/feedbacks` | BIM detail — tab Ghi chú AR | ✅ cursor |
| GET | `/bim-models/:id/versions` | BIM detail — tab Lịch sử phiên bản | ✅ cursor |
| POST | `/bim-models/upload-url` | Presigned URL upload bundle/preview | — |

**GET `/bim-models` filters:** `project_id`, `discipline`, `search`, `active_only`

---

## 5. QR Markers

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/qr-markers` | QR page table | ✅ cursor |
| GET | `/qr-markers/:id` | QR detail | — |
| POST | `/qr-markers` | Thêm QR modal | — |
| PATCH | `/qr-markers/:id` | Sửa marker | — |
| DELETE | `/qr-markers/:id` | Soft delete | — |
| GET | `/qr-markers/:id/qr-image` | Download PNG QR | — |
| POST | `/qr-markers/import` | Import CSV | — |

**GET `/qr-markers` filters:** `project_id`, `floor_level`, `marker_type` (`field` \| `tabletop`), `search`

**POST/PATCH body (AR):** `marker_type`, `paper_size`, `tabletop_scale`, `offset_to_center_x`, `offset_to_center_z`, `paper_rotation_y` (tabletop); plus `physical_width_m`, `bim_pos_*`, `floor_level`, …

Migration: `migrations/004_qr_marker_tabletop.sql`

---

## 6. GPS POIs

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/gps-pois` | GPS page table | ✅ cursor |
| GET | `/gps-pois/map` | GPS page — bản đồ markers | 120s |
| GET | `/gps-pois/:id` | POI detail | — |
| POST | `/gps-pois` | Thêm POI modal | — |
| PATCH | `/gps-pois/:id` | Sửa POI | — |
| DELETE | `/gps-pois/:id` | Soft delete | — |

**GET `/gps-pois` filters:** `model_id`, `project_id`, `type`, `search`

**GET `/gps-pois/map` response:** GeoJSON FeatureCollection

---

## 7. M&E Elements (Phase 1 — từ BIM metadata)

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/elements` | Elements page table | ✅ cursor |
| GET | `/elements/:guid` | Element detail modal | — |

**GET `/elements` filters:** `model_id`, `discipline`, `search`

> Phase 2: bảng `bim_elements` riêng với IFC GUID, manufacturer, category.

---

## 8. Feedbacks

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/feedbacks` | Feedback list view | ✅ cursor |
| GET | `/feedbacks/board` | Feedback Kanban board | 60s |
| GET | `/feedbacks/:id` | Feedback detail modal | — |
| POST | `/feedbacks` | Tạo feedback | — |
| PATCH | `/feedbacks/:id` | Cập nhật status/assignee | — |
| DELETE | `/feedbacks/:id` | Soft delete | — |
| POST | `/feedbacks/:id/comments` | Thêm comment (phase 2) | — |

**GET `/feedbacks` filters:** `project_id`, `status`, `priority`, `user_id`, `search`

**GET `/feedbacks/board` response:**

```json
{
  "open": [...],
  "in_progress": [...],
  "resolved": [...],
  "closed": []
}
```

---

## 9. Users

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/users` | Users page table | ✅ cursor |
| GET | `/users/stats` | Users page — stat cards | 120s |
| GET | `/users/:id` | User detail / edit modal | — |
| POST | `/users` | Thêm user modal | — |
| PATCH | `/users/:id` | Sửa user + permissions | — |
| DELETE | `/users/:id` | Soft delete | — |
| PATCH | `/users/:id/password` | Reset password | — |
| GET | `/users/:id/projects` | Tab permissions — project access | — |
| POST | `/users/import` | Import CSV | — |

**GET `/users` filters:** `role`, `search`

---

## 10. Settings

| Method | Endpoint | UI | Cache |
|--------|----------|-----|-------|
| GET | `/settings` | Settings page (all tabs) | 600s |
| PATCH | `/settings` | Lưu thay đổi | invalidate |

**Sections:** `general`, `ar`, `notifications`, `integrations`, `security`

> Lưu trong Redis key `pa3:settings` hoặc bảng `system_settings` (JSON columns).

---

## 11. Audit Logs (Phase 2)

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/audit-logs` | Audit page table | ✅ cursor |
| GET | `/audit-logs/export` | Export CSV | — |

**GET `/audit-logs` filters:** `action`, `user_id`, `from`, `to`, `search`

---

## 12. Global Search & Notifications

| Method | Endpoint | UI | Pagination |
|--------|----------|-----|------------|
| GET | `/search` | Header search bar | ✅ cursor |
| GET | `/notifications` | Header bell icon | ✅ cursor |
| PATCH | `/notifications/:id/read` | Mark as read | — |
| PATCH | `/notifications/read-all` | Mark all read | — |

**GET `/search?q=`** — tìm across projects, bim_models, qr_markers, feedbacks, users.

---

## Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid cursor",
    "details": []
  }
}
```

| HTTP | Code | Mô tả |
|------|------|-------|
| 400 | VALIDATION_ERROR | Input không hợp lệ |
| 401 | UNAUTHORIZED | Token thiếu/hết hạn |
| 403 | FORBIDDEN | Không đủ quyền |
| 404 | NOT_FOUND | Resource không tồn tại |
| 409 | CONFLICT | Duplicate (email, marker_code) |
| 429 | RATE_LIMITED | Quá giới hạn request |
| 500 | INTERNAL_ERROR | Lỗi server |

---

## Schema gaps — đề xuất migration

```sql
-- Projects: fields UI cần
ALTER TABLE projects ADD COLUMN code VARCHAR(50) UNIQUE;
ALTER TABLE projects ADD COLUMN owner VARCHAR(255);
ALTER TABLE projects ADD COLUMN contractor VARCHAR(255);
ALTER TABLE projects ADD COLUMN start_date DATE;
ALTER TABLE projects ADD COLUMN end_date DATE;
ALTER TABLE projects ADD COLUMN cover_image_url VARCHAR(512);
ALTER TABLE projects ADD COLUMN metadata JSON;

-- QR: status tracking
ALTER TABLE qr_markers ADD COLUMN status ENUM('active','damaged','removed') DEFAULT 'active';
ALTER TABLE qr_markers ADD COLUMN installed_at DATETIME;

-- BIM: active version flag + previews
ALTER TABLE bim_models ADD COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE bim_models ADD COLUMN preview_images JSON;
ALTER TABLE bim_models ADD COLUMN uploaded_by CHAR(36);
ALTER TABLE bim_models ADD COLUMN model_type ENUM('indoor','outdoor') DEFAULT 'indoor';

-- Feedbacks: assignee
ALTER TABLE feedbacks ADD COLUMN assignee_id CHAR(36);
ALTER TABLE feedbacks ADD COLUMN due_date DATE;
ALTER TABLE feedbacks ADD COLUMN project_id CHAR(36);

-- Audit logs
CREATE TABLE audit_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  ip_address VARCHAR(45),
  result ENUM('ok','err') DEFAULT 'ok',
  metadata JSON,
  created_at DATETIME NOT NULL,
  INDEX idx_audit_created (created_at, id)
);

-- System settings
CREATE TABLE system_settings (
  id CHAR(36) PRIMARY KEY,
  section VARCHAR(50) NOT NULL,
  settings JSON NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY unique_section (section)
);
```

---

## Tổng hợp endpoint

| # | Method | Endpoint | Cursor | Cache |
|---|--------|----------|--------|-------|
| 1 | POST | `/auth/login` | | |
| 2 | POST | `/auth/logout` | | |
| 3 | POST | `/auth/refresh` | | |
| 4 | GET | `/auth/me` | | ✅ |
| 5 | GET | `/dashboard/stats` | | ✅ |
| 6 | GET | `/dashboard/recent-feedbacks` | | ✅ |
| 7 | GET | `/dashboard/recent-bim` | | ✅ |
| 8 | GET | `/dashboard/feedback-trend` | | ✅ |
| 9 | GET | `/dashboard/priority-distribution` | | ✅ |
| 10 | GET | `/projects` | ✅ | ✅ |
| 11 | GET | `/projects/:id` | | ✅ |
| 12 | POST | `/projects` | | |
| 13 | PATCH | `/projects/:id` | | |
| 14 | DELETE | `/projects/:id` | | |
| 15 | GET | `/projects/:id/stats` | | ✅ |
| 16 | GET | `/projects/:id/bim-models` | ✅ | ✅ |
| 17 | GET | `/projects/:id/team` | | ✅ |
| 18 | GET | `/bim-models` | ✅ | ✅ |
| 19 | GET | `/bim-models/:id` | | ✅ |
| 20 | POST | `/bim-models` | | |
| 21 | PATCH | `/bim-models/:id` | | |
| 22 | DELETE | `/bim-models/:id` | | |
| 23 | GET | `/bim-models/:id/feedbacks` | ✅ | ✅ |
| 24 | GET | `/bim-models/:id/versions` | ✅ | ✅ |
| 25 | GET | `/qr-markers` | ✅ | ✅ |
| 26 | GET | `/qr-markers/:id` | | ✅ |
| 27 | POST | `/qr-markers` | | |
| 28 | PATCH | `/qr-markers/:id` | | |
| 29 | DELETE | `/qr-markers/:id` | | |
| 30 | GET | `/gps-pois` | ✅ | ✅ |
| 31 | GET | `/gps-pois/map` | | ✅ |
| 32 | GET | `/gps-pois/:id` | | ✅ |
| 33 | POST | `/gps-pois` | | |
| 34 | PATCH | `/gps-pois/:id` | | |
| 35 | DELETE | `/gps-pois/:id` | | |
| 36 | GET | `/elements` | ✅ | ✅ |
| 37 | GET | `/elements/:guid` | | ✅ |
| 38 | GET | `/feedbacks` | ✅ | ✅ |
| 39 | GET | `/feedbacks/board` | | ✅ |
| 40 | GET | `/feedbacks/:id` | | ✅ |
| 41 | POST | `/feedbacks` | | |
| 42 | PATCH | `/feedbacks/:id` | | |
| 43 | DELETE | `/feedbacks/:id` | | |
| 44 | GET | `/users` | ✅ | ✅ |
| 45 | GET | `/users/stats` | | ✅ |
| 46 | GET | `/users/:id` | | ✅ |
| 47 | POST | `/users` | | |
| 48 | PATCH | `/users/:id` | | |
| 49 | DELETE | `/users/:id` | | |
| 50 | GET | `/settings` | | ✅ |
| 51 | PATCH | `/settings` | | |
| 52 | GET | `/audit-logs` | ✅ | ✅ |
| 53 | GET | `/search` | ✅ | ✅ |
| 54 | GET | `/notifications` | ✅ | ✅ |

**Tổng: 54 endpoints** (38 có cursor pagination, 28 có Redis cache)
