import { Router } from 'express'
import { authController } from './auth.controller.js'
import { authenticate } from './auth.middleware.js'

export const authRouter = Router()

authRouter.post('/login', authController.login)
authRouter.post('/change-password', authenticate, authController.changePassword)
authRouter.get('/me', authenticate, authController.me)
