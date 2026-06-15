import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { withTransaction } from '../db.js'

interface SetDisabledRow {
  uid: string
  account_status: 'active' | 'disabled'
}

interface UserIdentityRow {
  uid: string
  email: string
}

interface DeletedUserRow {
  uid: string
}

const setDisabledSchema = z.object({
  disabled: z.boolean(),
})

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

router.patch('/users/:uid/disabled', async (req, res) => {
  const parsed = setDisabledSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload.', issues: parsed.error.flatten() })
    return
  }

  const accountStatus = parsed.data.disabled ? 'disabled' : 'active'
  const { rows } = await withTransaction((client) =>
    client.query<SetDisabledRow>(
      `
        UPDATE users
        SET account_status = $2
        WHERE uid = $1
        RETURNING uid, account_status
      `,
      [req.params.uid, accountStatus],
    ),
  )

  if (rows.length === 0) {
    res.status(404).json({ message: 'User not found.' })
    return
  }

  res.json({
    uid: rows[0].uid,
    disabled: rows[0].account_status === 'disabled',
  })
})

router.post('/users/:uid/reset-link', async (req, res) => {
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString()

  const { rows } = await withTransaction(async (client) => {
    const userResult = await client.query<UserIdentityRow>(
      `SELECT uid, email FROM users WHERE uid = $1 LIMIT 1`,
      [req.params.uid],
    )

    if (userResult.rows.length === 0) {
      return userResult
    }

    await client.query(
      `
        INSERT INTO password_reset_tokens (uid, token_hash, expires_at)
        VALUES ($1, $2, $3)
      `,
      [req.params.uid, tokenHash, expiresAt],
    )

    return userResult
  })

  if (rows.length === 0) {
    res.status(404).json({ message: 'User not found.' })
    return
  }

  const resetLink = new URL(config.passwordResetLinkBase)
  resetLink.searchParams.set('uid', req.params.uid)
  resetLink.searchParams.set('token', rawToken)

  res.json({
    uid: rows[0].uid,
    email: rows[0].email,
    reset_link: resetLink.toString(),
  })
})

router.delete('/users/:uid', async (req, res) => {
  const result = await withTransaction(async (client) => {
    const devicesDelete = await client.query('DELETE FROM devices WHERE uid = $1', [req.params.uid])
    const userDelete = await client.query<DeletedUserRow>('DELETE FROM users WHERE uid = $1 RETURNING uid', [req.params.uid])

    return {
      deletedDevicesCount: devicesDelete.rowCount ?? 0,
      deletedUser: userDelete.rows[0] ?? null,
    }
  })

  if (!result.deletedUser) {
    res.status(404).json({ message: 'User not found.' })
    return
  }

  res.json({
    uid: req.params.uid,
    deleted_profile: true,
    deleted_devices_count: result.deletedDevicesCount,
  })
})

export { router as adminRoutes }
