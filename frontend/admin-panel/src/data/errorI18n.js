import { I18N } from './i18n.js'

const LANG_STORAGE_KEY = 'pa3_lang'

/** Messages by error key. Keys prefixed with code names are generic fallbacks per backend error code. */
export const ERROR_MESSAGES = {
  ERROR: { vi: 'Đã xảy ra lỗi', en: 'Something went wrong', ja: 'エラーが発生しました' },
  VALIDATION_ERROR: { vi: 'Dữ liệu không hợp lệ', en: 'Invalid input', ja: '入力内容が正しくありません' },
  NOT_FOUND: { vi: 'Không tìm thấy dữ liệu', en: 'Not found', ja: 'データが見つかりません' },
  CONFLICT: { vi: 'Dữ liệu bị trùng hoặc xung đột', en: 'Conflicts with existing data', ja: '既存のデータと競合しています' },
  UNAUTHORIZED: { vi: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn', en: 'Your session is invalid or has expired', ja: 'セッションが無効か期限切れです。再度ログインしてください' },
  FORBIDDEN: { vi: 'Bạn không có quyền thực hiện thao tác này', en: 'You do not have permission to do this', ja: 'この操作を行う権限がありません' },
  SERVICE_UNAVAILABLE: { vi: 'Dịch vụ tạm thời không khả dụng', en: 'Service temporarily unavailable', ja: 'サービスは一時的に利用できません' },
  EMAIL_NOT_VERIFIED: { vi: 'Vui lòng xác minh email trước khi đăng nhập', en: 'Please verify your email before logging in', ja: 'ログインする前にメールアドレスを確認してください' },
  EMAIL_SEND_FAILED: { vi: 'Không gửi được email. Vui lòng thử lại sau', en: 'Could not send the email. Please try again later', ja: 'メールを送信できませんでした。後でもう一度お試しください' },
  UPLOAD_FAILED: { vi: 'Tải lên thất bại', en: 'Upload failed', ja: 'アップロードに失敗しました' },
  CONVERSION_FAILED: { vi: 'Chuyển đổi IFC thất bại', en: 'IFC conversion failed', ja: 'IFCの変換に失敗しました' },
  INTERNAL_ERROR: { vi: 'Lỗi máy chủ nội bộ', en: 'Internal server error', ja: 'サーバー内部エラーが発生しました' },
  NETWORK_ERROR: { vi: 'Không kết nối được máy chủ', en: 'Cannot reach the server', ja: 'サーバーに接続できません' },
  GATEWAY_TIMEOUT: { vi: 'Máy chủ phản hồi quá lâu, vui lòng thử lại', en: 'The server took too long to respond, please try again', ja: 'サーバーの応答がタイムアウトしました。もう一度お試しください' },

  query_too_short: { vi: 'Từ khóa tìm kiếm tối thiểu 2 ký tự', en: 'Search query must be at least 2 characters', ja: '検索キーワードは2文字以上入力してください' },
  invalid_cursor: { vi: 'Tham số phân trang không hợp lệ', en: 'Invalid pagination cursor', ja: 'ページングのパラメータが正しくありません' },
  no_fields: { vi: 'Không có trường nào để cập nhật', en: 'No fields to update', ja: '更新する項目がありません' },
  content_required: { vi: 'Vui lòng nhập nội dung', en: 'Content is required', ja: '内容を入力してください' },
  name_required: { vi: 'Vui lòng nhập tên', en: 'Name is required', ja: '名前を入力してください' },
  required_fields: { vi: 'Vui lòng nhập đầy đủ các trường bắt buộc', en: 'Please fill in all required fields', ja: '必須項目をすべて入力してください' },
  password_required: { vi: 'Vui lòng nhập mật khẩu', en: 'Password is required', ja: 'パスワードを入力してください' },

  feedback_not_found: { vi: 'Không tìm thấy phản hồi', en: 'Feedback not found', ja: 'フィードバックが見つかりません' },
  qr_not_found: { vi: 'Không tìm thấy QR marker', en: 'QR marker not found', ja: 'QRマーカーが見つかりません' },
  notification_not_found: { vi: 'Không tìm thấy thông báo', en: 'Notification not found', ja: '通知が見つかりません' },
  group_not_found: { vi: 'Không tìm thấy nhóm', en: 'Group not found', ja: 'グループが見つかりません' },
  company_group_not_found: { vi: 'Không tìm thấy nhóm công ty', en: 'Company group not found', ja: '会社グループが見つかりません' },
  attr_group_not_found: { vi: 'Không tìm thấy nhóm thuộc tính', en: 'Attribute group not found', ja: '属性グループが見つかりません' },
  user_not_found: { vi: 'Không tìm thấy người dùng', en: 'User not found', ja: 'ユーザーが見つかりません' },
  project_not_found: { vi: 'Không tìm thấy dự án', en: 'Project not found', ja: 'プロジェクトが見つかりません' },
  bim_not_found: { vi: 'Không tìm thấy mô hình BIM', en: 'BIM model not found', ja: 'BIMモデルが見つかりません' },
  poi_not_found: { vi: 'Không tìm thấy POI', en: 'GPS POI not found', ja: 'GPS POIが見つかりません' },

  group_name_exists: { vi: 'Tên nhóm đã tồn tại', en: 'Group name already exists', ja: 'このグループ名は既に存在します' },
  group_has_projects: { vi: 'Nhóm vẫn còn dự án liên kết', en: 'This group still has linked projects', ja: 'このグループにはまだプロジェクトが紐付いています' },
  group_has_users: { vi: 'Nhóm vẫn còn người dùng', en: 'This group still has users assigned', ja: 'このグループにはまだユーザーが所属しています' },
  email_exists: { vi: 'Email đã được sử dụng', en: 'Email is already in use', ja: 'このメールアドレスは既に使用されています' },
  invalid_email: { vi: 'Email không hợp lệ', en: 'Invalid email address', ja: 'メールアドレスが正しくありません' },
  gmail_only: { vi: 'Chỉ chấp nhận địa chỉ Gmail (@gmail.com)', en: 'Only Gmail addresses (@gmail.com) are accepted', ja: 'Gmailアドレス (@gmail.com) のみ利用できます' },
  invalid_role: { vi: 'Vai trò phải là admin, bql hoặc engineer', en: 'Role must be admin, bql or engineer', ja: 'ロールは admin、bql、engineer のいずれかを指定してください' },
  last_admin_role: { vi: 'Không thể đổi vai trò admin cuối cùng', en: 'Cannot change the role of the last admin', ja: '最後の管理者のロールは変更できません' },
  last_admin_delete: { vi: 'Không thể xóa admin cuối cùng', en: 'Cannot delete the last admin', ja: '最後の管理者は削除できません' },
  delete_self: { vi: 'Không thể xóa tài khoản đang đăng nhập', en: 'You cannot delete the account you are signed in with', ja: 'ログイン中のアカウントは削除できません' },
  no_project_access: { vi: 'Bạn không có quyền truy cập dự án này', en: 'You do not have access to this project', ja: 'このプロジェクトへのアクセス権がありません' },
  bql_no_assign: { vi: 'BQL chưa được cấp quyền phân công kỹ sư', en: 'This manager is not allowed to assign engineers', ja: 'この管理者にはエンジニアを割り当てる権限がありません' },
  engineer_only: { vi: 'Chỉ gán kỹ sư (engineer) vào dự án', en: 'Only engineers can be assigned to a project', ja: 'プロジェクトに割り当てられるのはエンジニアのみです' },
  invalid_color: { vi: 'Mã màu phải có dạng #RRGGBB', en: 'Color must be in #RRGGBB format', ja: '色は #RRGGBB 形式で指定してください' },

  email_verified: { vi: 'Email đã được xác minh', en: 'Email is already verified', ja: 'このメールアドレスは既に確認済みです' },
  invalid_code: { vi: 'Mã xác minh không đúng hoặc đã hết hạn', en: 'The code is invalid or has expired', ja: '確認コードが正しくないか、有効期限が切れています' },
  invalid_reset_link: { vi: 'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', en: 'The reset code is invalid or has expired', ja: 'パスワード再設定コードが無効か、有効期限が切れています' },
  wrong_current_pwd: { vi: 'Mật khẩu hiện tại không đúng', en: 'Current password is incorrect', ja: '現在のパスワードが正しくありません' },
  email_pwd_required: { vi: 'Vui lòng nhập email và mật khẩu', en: 'Email and password are required', ja: 'メールアドレスとパスワードを入力してください' },
  invalid_credentials: { vi: 'Email hoặc mật khẩu không đúng', en: 'Incorrect email or password', ja: 'メールアドレスまたはパスワードが正しくありません' },

  s3_not_configured: { vi: 'Máy chủ chưa cấu hình lưu trữ S3', en: 'S3 storage is not configured on the server', ja: 'サーバーにS3ストレージが設定されていません' },
  s3_upload_failed: { vi: 'Tải tệp lên S3 thất bại', en: 'Uploading the file to S3 failed', ja: 'S3へのファイルアップロードに失敗しました' },
  ifc_too_large: { vi: 'Tệp IFC quá lớn (tối đa 500MB)', en: 'IFC file is too large (max 500MB)', ja: 'IFCファイルが大きすぎます (最大500MB)' },
  ifc_only: { vi: 'Chỉ chấp nhận tệp .ifc', en: 'File must be .ifc', ja: '.ifc ファイルのみアップロードできます' },
  ifc_required: { vi: 'Vui lòng chọn tệp IFC', en: 'Please select an IFC file', ja: 'IFCファイルを選択してください' },
  version_required: { vi: 'Vui lòng chọn dự án và nhập phiên bản', en: 'Project and version are required', ja: 'プロジェクトとバージョンを指定してください' },
  upload_session_expired: { vi: 'Phiên tải lên đã hết hạn, vui lòng tải lại từ đầu', en: 'Upload session expired, please upload again', ja: 'アップロードセッションの有効期限が切れました。最初からアップロードし直してください' },
  upload_job_expired: { vi: 'Không tìm thấy tiến trình xử lý hoặc đã hết hạn', en: 'Upload job not found or expired', ja: '処理ジョブが見つからないか、有効期限が切れています' },
  chunk_too_large: { vi: 'Gói dữ liệu tải lên quá lớn (cấu hình máy chủ)', en: 'Upload chunk is too large (server configuration)', ja: 'アップロードデータが大きすぎます (サーバー設定)' },
  upload_incomplete: { vi: 'Tải lên chưa hoàn tất, vui lòng thử lại', en: 'Upload is incomplete, please try again', ja: 'アップロードが完了していません。もう一度お試しください' },
  disk_full: { vi: 'Ổ đĩa máy chủ đã đầy', en: 'Server disk is full', ja: 'サーバーのディスク容量が不足しています' },
}

/** Exact backend message → error key. */
const MESSAGE_KEYS = {
  'Query must be at least 2 characters': 'query_too_short',
  'Invalid cursor': 'invalid_cursor',
  'No fields to update': 'no_fields',
  'body required': 'content_required',
  'content required': 'content_required',
  'name is required': 'name_required',
  'password required': 'password_required',
  'email, password, full_name required': 'required_fields',
  'marker_code and project_id required': 'required_fields',
  'name, type, lat_wgs84, lng_wgs84 required': 'required_fields',
  'Feedback not found': 'feedback_not_found',
  'QR marker not found': 'qr_not_found',
  'Notification not found': 'notification_not_found',
  'Group not found': 'group_not_found',
  'Company group not found': 'company_group_not_found',
  'Attribute group not found': 'attr_group_not_found',
  'User not found': 'user_not_found',
  'Project not found': 'project_not_found',
  'BIM model not found': 'bim_not_found',
  'GPS POI not found': 'poi_not_found',
  'Group name already exists': 'group_name_exists',
  'Group still has linked projects': 'group_has_projects',
  'Group is still assigned to projects': 'group_has_projects',
  'Group still has users assigned': 'group_has_users',
  'Email already exists': 'email_exists',
  'Email already registered': 'email_exists',
  'Email không hợp lệ': 'invalid_email',
  'Invalid email': 'invalid_email',
  'Valid email required': 'invalid_email',
  'Chỉ chấp nhận địa chỉ Gmail (@gmail.com)': 'gmail_only',
  'role must be admin, bql, or engineer': 'invalid_role',
  'Không thể đổi vai trò admin cuối cùng': 'last_admin_role',
  'Không thể xóa admin cuối cùng': 'last_admin_delete',
  'Không thể xóa tài khoản đang đăng nhập': 'delete_self',
  'You do not have access to this project': 'no_project_access',
  'BQL chưa được cấp quyền phân công kỹ sư': 'bql_no_assign',
  'Chỉ gán kỹ sư (engineer) vào dự án': 'engineer_only',
  'color_hex must be #RRGGBB': 'invalid_color',
  'Email already verified': 'email_verified',
  'Invalid or expired code': 'invalid_code',
  'Invalid or expired reset link': 'invalid_reset_link',
  'Invalid or expired reset code': 'invalid_reset_link',
  'email, code and password required': 'required_fields',
  'Current password is incorrect': 'wrong_current_pwd',
  'Email and password required': 'email_pwd_required',
  'Invalid credentials': 'invalid_credentials',
  'S3 chưa được cấu hình trên server': 's3_not_configured',
  'S3 upload failed': 's3_upload_failed',
  'IFC file too large (max 500MB)': 'ifc_too_large',
  'File must be .ifc': 'ifc_only',
  'IFC file required': 'ifc_required',
  'project_id and version required': 'version_required',
  'Upload session expired': 'upload_session_expired',
  'Upload session not found or expired — upload lại từ đầu': 'upload_session_expired',
  'Invalid upload session id': 'upload_session_expired',
  'Upload job not found or expired': 'upload_job_expired',
  'Chunk too large (max 5MB)': 'chunk_too_large',
  'Chunk too large — increase nginx client_max_body_size (≥6m)': 'chunk_too_large',
  'Server disk full — cannot save chunk': 'disk_full',
}

const MESSAGE_PATTERNS = [
  [/^Missing chunk/, 'upload_incomplete'],
  [/^Merged size mismatch/, 'upload_incomplete'],
  [/^Chunk body empty/, 'chunk_too_large'],
]

/** Codes whose generic text is too vague on its own, so the raw server detail is appended. */
const APPEND_DETAIL = new Set(['VALIDATION_ERROR', 'CONVERSION_FAILED', 'UPLOAD_FAILED', 'ERROR'])

const PASSWORD_RULE_KEYS = {
  MIN_LENGTH: 'pwd_rule_len',
  UPPER: 'pwd_rule_upper',
  LOWER: 'pwd_rule_lower',
  DIGIT: 'pwd_rule_digit',
  SPECIAL: 'pwd_rule_special',
}

export function currentLang() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (stored && I18N[stored]) return stored
  } catch { /* private mode */ }
  return 'vi'
}

function pick(key, lang) {
  const entry = ERROR_MESSAGES[key]
  return entry ? entry[lang] || entry.vi : null
}

function keyForMessage(message) {
  if (!message) return null
  if (MESSAGE_KEYS[message]) return MESSAGE_KEYS[message]
  const hit = MESSAGE_PATTERNS.find(([re]) => re.test(message))
  return hit ? hit[1] : null
}

function codeForStatus(code, status) {
  if (code && code !== 'ERROR') return code
  if (status === 504 || status === 502) return 'GATEWAY_TIMEOUT'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status >= 500) return 'INTERNAL_ERROR'
  return code || 'ERROR'
}

/** Translate a backend error ({ code, message, details }) into the user's current language. */
export function localizeError({ code, message, status, details } = {}, lang = currentLang()) {
  const rule = Array.isArray(details) ? details.find((d) => d && PASSWORD_RULE_KEYS[d.code]) : null
  if (rule) {
    const text = I18N[lang]?.[PASSWORD_RULE_KEYS[rule.code]] || I18N.vi[PASSWORD_RULE_KEYS[rule.code]]
    return text.replace('{n}', rule.minLength ?? '')
  }

  const key = keyForMessage(message)
  if (key) return pick(key, lang)

  const effectiveCode = codeForStatus(code, status)
  const generic = pick(effectiveCode, lang) || pick('ERROR', lang)
  const raw = message && message !== generic ? String(message) : ''
  const isStatusText = raw && /^[A-Z][A-Za-z ]+$/.test(raw) && raw.split(' ').length <= 4
  if (raw && APPEND_DETAIL.has(effectiveCode) && !isStatusText) return `${generic}: ${raw}`
  return generic
}
