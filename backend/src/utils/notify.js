import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../db/pool.js'
import { sendGenericEmail } from './email.js'
import { projectAssignedEmail, feedbackCommentEmail, normalizeLang } from './emailTemplates.js'

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
  const user = await queryOne(
    'SELECT email, full_name, language FROM users WHERE id = ?',
    [userId],
  )
  const copy = projectAssignedEmail(user?.language, {
    fullName: user?.full_name,
    projectName,
  })
  await createNotification({
    userId,
    type: 'project_assigned',
    title: copy.title,
    body: copy.body,
    linkPath: `/projects?open=${projectId}`,
  })
  if (user?.email) {
    await sendGenericEmail({
      to: user.email,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
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
    `SELECT id, email, full_name, language FROM users
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

  const sendTo = async (recipient) => {
    if (!recipient?.email || recipient.id === authorUserId) return
    const copy = feedbackCommentEmail(normalizeLang(recipient.language), {
      feedbackTitle,
      feedbackId,
      commentBody,
      authorName,
      authorRole,
      threadHtml,
      threadText,
    })
    await createNotification({
      userId: recipient.id,
      type: 'feedback_comment',
      title: copy.subject,
      body: copy.notifBody,
      linkPath: `/feedback?open=${feedbackId}`,
    })
    await sendGenericEmail({
      to: recipient.email,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
    })
  }

  for (const admin of admins) {
    await sendTo(admin)
  }

  if (fb.user_id && fb.user_id !== authorUserId) {
    const reporter = await queryOne(
      'SELECT id, email, language FROM users WHERE id = ?',
      [fb.user_id],
    )
    await sendTo(reporter)
  }
}
