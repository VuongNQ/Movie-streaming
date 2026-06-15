import express, { type NextFunction, type Request, type Response } from 'express'
import { authRoutes } from './routes/authRoutes.js'
import { adminRoutes } from './routes/adminRoutes.js'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.use('/auth', authRoutes)
app.use('/admin', adminRoutes)

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  res.status(500).json({ message: 'Unhandled server error.' })
})

export { app }
