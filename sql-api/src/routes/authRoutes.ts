import { Router } from 'express'
import { z } from 'zod'
import { authenticateWithPassword, issueAccessToken } from '../auth.js'
import { requireAuth } from '../middleware/auth.js'
import { AccountDisabledError } from '../types/contracts.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const router = Router()

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid login payload.', issues: parsed.error.flatten() })
    return
  }

  try {
    const user = await authenticateWithPassword(parsed.data.email, parsed.data.password)
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' })
      return
    }

    const token = issueAccessToken(user)
    res.json({
      access_token: token,
      user,
    })
  } catch (error) {
    if (error instanceof AccountDisabledError) {
      res.status(403).json({ message: 'Account is disabled.' })
      return
    }

    res.status(500).json({ message: 'Login failed.' })
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({
    uid: req.auth!.uid,
    role: req.auth!.role,
    email: req.auth!.email,
  })
})

export { router as authRoutes }
