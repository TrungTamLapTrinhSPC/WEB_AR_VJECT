import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { sendGenericEmail } from './email.js'

export async function createNotification({ userId, type, title, body, linkPath }) {
  const id = uuidv4()
  await query(
    `INSERT INTO notifications (id, user_id, type, title, body, link_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [id, userId, type, title, body || null, linkPath || null],
  )
  return id
}

export async function notifyProjectAssignment(userId, projectName, projectId) {
  const title = 'Bạn được gán vào dự án'
  const body = `Dự án: ${projectName}`
  await createNotification({
    userId,
    type: 'project_assigned',
    title,
    body,
    linkPath: `/projects?open=${projectId}`,
  })
  const user = await queryOne('SELECT email, full_name FROM users WHERE id = ?', [userId])
  if (user?.email) {
    await sendGenericEmail({
      to: user.email,
      subject: `[PA3 AR] ${title}`,
      text: `${body}\n\nĐăng nhập admin panel để xem chi tiết.`,
      html: `<p>Xin chào ${user.full_name || ''},</p><p>${body}</p><p>Đăng nhập admin panel để xem chi tiết.</p>`,
    })
  }
}

export async function notifyFeedbackComment({
  feedbackId, feedbackTitle, commentBody, authorName, authorRole, authorUserId,
}) {
  const fb = await queryOne(
    `SELECT f.id, f.title, f.user_id, u.email AS author_email, u.full_name AS reporter_name
     FROM feedbacks f
     JOIN users u ON u.id = f.user_id
     WHERE f.id = ? AND f.deleted_at IS NULL`,
    [feedbackId],
  )
  if (!fb) return

  const admins = await query(
    `SELECT id, email, full_name FROM users
     WHERE role IN ('admin', 'bql') AND deleted_at IS NULL AND email IS NOT NULL`,
  )

  const comments = await query(
    `SELECT c.body, c.created_at, u.full_name, u.role
     FROM feedback_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.feedback_id = ?
     ORDER BY c.created_at ASC`,
    [feedbackId],
  )

  const threadHtml = comments.map((c) =>
    `<li><strong>${c.full_name}</strong> (${c.role}) — ${new Date(c.created_at).toLocaleString()}<br>${c.body}</li>`,
  ).join('')

  const threadText = comments.map((c) =>
    `- ${c.full_name} (${c.role}): ${c.body}`,
  ).join('\n')

  const subject = `[PA3 AR] Comment mới — ${feedbackTitle || feedbackId}`
  const html = `
    <p>Phản hồi: <strong>${feedbackTitle || feedbackId}</strong></p>
    <p>Comment mới từ <strong>${authorName}</strong> (${authorRole}):</p>
    <blockquote>${commentBody}</blockquote>
    <p><strong>Toàn bộ hội thoại:</strong></p>
    <ul>${threadHtml}</ul>
  `
  const text = `Phản hồi: ${feedbackTitle}\n\nComment mới từ ${authorName}:\n${commentBody}\n\n--- Thread ---\n${threadText}`

  for (const admin of admins) {
    if (admin.id === authorUserId) continue
    await createNotification({
      userId: admin.id,
      type: 'feedback_comment',
      title: subject,
      body: commentBody.slice(0, 200),
      linkPath: `/feedback?open=${feedbackId}`,
    })
    await sendGenericEmail({ to: admin.email, subject, text, html })
  }

  if (fb.user_id && fb.user_id !== authorUserId) {
    const reporter = await queryOne('SELECT email FROM users WHERE id = ?', [fb.user_id])
    if (reporter?.email) {
      await createNotification({
        userId: fb.user_id,
        type: 'feedback_comment',
        title: subject,
        body: commentBody.slice(0, 200),
        linkPath: `/feedback?open=${feedbackId}`,
      })
      await sendGenericEmail({ to: reporter.email, subject, text, html })
    }
  }
}
