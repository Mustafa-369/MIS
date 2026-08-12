import { Router } from 'express'
import { workforceController } from './workforce.controller.js'

export const workforceRouter = Router()

workforceRouter.get('/capabilities', workforceController.capabilities.list)
workforceRouter.get('/capabilities/:id', workforceController.capabilities.get)

workforceRouter.get('/employees', workforceController.employees.list)
workforceRouter.get('/employees/:id', workforceController.employees.get)
workforceRouter.post('/employees', workforceController.employees.create)

workforceRouter.get('/app-users', workforceController.appUsers.list)
workforceRouter.get('/app-users/:id', workforceController.appUsers.get)
workforceRouter.post('/app-users', workforceController.appUsers.create)

workforceRouter.get('/machines', workforceController.machines.list)
workforceRouter.get('/machines/:id', workforceController.machines.get)

workforceRouter.get('/employee-positions', workforceController.employeePositions.list)
workforceRouter.get('/employee-positions/:employeeId', workforceController.employeePositions.getByEmployee)
workforceRouter.post('/employee-positions', workforceController.employeePositions.create)
