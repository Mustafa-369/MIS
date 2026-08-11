import { Router } from 'express'
import { foundationController } from './foundation.controller.js'

export const foundationRouter = Router()

foundationRouter.get('/roles', foundationController.roles.list)
foundationRouter.get('/roles/:id', foundationController.roles.get)

foundationRouter.get('/locations', foundationController.locations.list)
foundationRouter.get('/locations/:id', foundationController.locations.get)

foundationRouter.get('/departments', foundationController.departments.list)
foundationRouter.get('/departments/:id', foundationController.departments.get)

foundationRouter.get('/positions', foundationController.positions.list)
foundationRouter.get('/positions/:id', foundationController.positions.get)

foundationRouter.get('/cost-centers', foundationController.costCenters.list)
foundationRouter.get('/cost-centers/:id', foundationController.costCenters.get)

foundationRouter.get('/work-centers', foundationController.workCenters.list)
foundationRouter.get('/work-centers/:id', foundationController.workCenters.get)
