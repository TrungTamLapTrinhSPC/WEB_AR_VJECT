/** System email copy in vi / en / ja. */

export function normalizeLang(lang) {
  const l = String(lang || 'vi').toLowerCase().slice(0, 2)
  return l === 'en' || l === 'ja' ? l : 'vi'
}

function pick(lang, map) {
  const l = normalizeLang(lang)
  return map[l] || map.vi
}

export function verificationEmail(lang, { code, ttlMinutes }) {
  return pick(lang, {
    vi: {
      subject: 'PA3 — Mã kích hoạt tài khoản',
      text: `Mã kích hoạt tài khoản PA3 Hybrid AR của bạn: ${code}\n\nMã có hiệu lực ${ttlMinutes} phút.`,
      html: `<p>Mã kích hoạt tài khoản <strong>PA3 Hybrid AR</strong>:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Mã có hiệu lực ${ttlMinutes} phút.</p>`,
    },
    en: {
      subject: 'PA3 — Account activation code',
      text: `Your PA3 Hybrid AR activation code: ${code}\n\nThis code expires in ${ttlMinutes} minutes.`,
      html: `<p>Your <strong>PA3 Hybrid AR</strong> activation code:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in ${ttlMinutes} minutes.</p>`,
    },
    ja: {
      subject: 'PA3 — アカウント有効化コード',
      text: `PA3 Hybrid AR の有効化コード: ${code}\n\n有効期限は ${ttlMinutes} 分です。`,
      html: `<p><strong>PA3 Hybrid AR</strong> の有効化コード:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>有効期限は ${ttlMinutes} 分です。</p>`,
    },
  })
}

export function passwordResetEmail(lang, { code, ttlMinutes }) {
  return pick(lang, {
    vi: {
      subject: 'PA3 — Mã đặt lại mật khẩu',
      text: `Mã đặt lại mật khẩu PA3 Hybrid AR của bạn: ${code}\n\nMã có hiệu lực ${ttlMinutes} phút. Nhập mã này trên trang đặt lại mật khẩu.`,
      html: `<p>Mã đặt lại mật khẩu <strong>PA3 Hybrid AR</strong>:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>Mã có hiệu lực ${ttlMinutes} phút. Nhập mã này trên trang đặt lại mật khẩu.</p>`,
    },
    en: {
      subject: 'PA3 — Password reset code',
      text: `Your PA3 Hybrid AR password reset code: ${code}\n\nThis code expires in ${ttlMinutes} minutes. Enter it on the reset password page.`,
      html: `<p>Your <strong>PA3 Hybrid AR</strong> password reset code:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in ${ttlMinutes} minutes. Enter it on the reset password page.</p>`,
    },
    ja: {
      subject: 'PA3 — パスワード再設定コード',
      text: `PA3 Hybrid AR のパスワード再設定コード: ${code}\n\n有効期限は ${ttlMinutes} 分です。再設定ページでこのコードを入力してください。`,
      html: `<p><strong>PA3 Hybrid AR</strong> のパスワード再設定コード:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>有効期限は ${ttlMinutes} 分です。再設定ページでこのコードを入力してください。</p>`,
    },
  })
}

export function projectAssignedEmail(lang, { fullName, projectName }) {
  return pick(lang, {
    vi: {
      title: 'Bạn được gán vào dự án',
      subject: '[PA3 AR] Bạn được gán vào dự án',
      body: `Dự án: ${projectName}`,
      text: `Dự án: ${projectName}\n\nĐăng nhập admin panel để xem chi tiết.`,
      html: `<p>Xin chào ${fullName || ''},</p><p>Dự án: <strong>${projectName}</strong></p><p>Đăng nhập admin panel để xem chi tiết.</p>`,
    },
    en: {
      title: 'You were assigned to a project',
      subject: '[PA3 AR] You were assigned to a project',
      body: `Project: ${projectName}`,
      text: `Project: ${projectName}\n\nSign in to the admin panel for details.`,
      html: `<p>Hello ${fullName || ''},</p><p>Project: <strong>${projectName}</strong></p><p>Sign in to the admin panel for details.</p>`,
    },
    ja: {
      title: 'プロジェクトに割り当てられました',
      subject: '[PA3 AR] プロジェクトに割り当てられました',
      body: `プロジェクト: ${projectName}`,
      text: `プロジェクト: ${projectName}\n\n管理画面にログインして詳細を確認してください。`,
      html: `<p>${fullName || ''} 様</p><p>プロジェクト: <strong>${projectName}</strong></p><p>管理画面にログインして詳細を確認してください。</p>`,
    },
  })
}

export function feedbackCommentEmail(lang, {
  feedbackTitle, feedbackId, commentBody, authorName, authorRole, threadHtml, threadText,
}) {
  const title = feedbackTitle || feedbackId
  return pick(lang, {
    vi: {
      subject: `[PA3 AR] Comment mới — ${title}`,
      notifBody: commentBody.slice(0, 200),
      text: `Phản hồi: ${title}\n\nComment mới từ ${authorName}:\n${commentBody}\n\n--- Thread ---\n${threadText}`,
      html: `
    <p>Phản hồi: <strong>${title}</strong></p>
    <p>Comment mới từ <strong>${authorName}</strong> (${authorRole}):</p>
    <blockquote>${commentBody}</blockquote>
    <p><strong>Toàn bộ hội thoại:</strong></p>
    <ul>${threadHtml}</ul>
  `,
    },
    en: {
      subject: `[PA3 AR] New comment — ${title}`,
      notifBody: commentBody.slice(0, 200),
      text: `Feedback: ${title}\n\nNew comment from ${authorName}:\n${commentBody}\n\n--- Thread ---\n${threadText}`,
      html: `
    <p>Feedback: <strong>${title}</strong></p>
    <p>New comment from <strong>${authorName}</strong> (${authorRole}):</p>
    <blockquote>${commentBody}</blockquote>
    <p><strong>Full thread:</strong></p>
    <ul>${threadHtml}</ul>
  `,
    },
    ja: {
      subject: `[PA3 AR] 新しいコメント — ${title}`,
      notifBody: commentBody.slice(0, 200),
      text: `フィードバック: ${title}\n\n${authorName} からの新しいコメント:\n${commentBody}\n\n--- スレッド ---\n${threadText}`,
      html: `
    <p>フィードバック: <strong>${title}</strong></p>
    <p><strong>${authorName}</strong> (${authorRole}) からの新しいコメント:</p>
    <blockquote>${commentBody}</blockquote>
    <p><strong>スレッド全体:</strong></p>
    <ul>${threadHtml}</ul>
  `,
    },
  })
}
