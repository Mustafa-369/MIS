import { foundationService } from './foundation.service.js'

function makeHandlers(listFn, getFn, notFoundLabel) {
  return {
    list: async (req, res) => {
      try {
        const rows = await listFn()
        res.json({ ok: true, data: rows })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
    get: async (req, res) => {
      try {
        const row = await getFn(req.params.id)
        if (!row) {
          res.status(404).json({ ok: false, error: `${notFoundLabel} not found` })
          return
        }
        res.json({ ok: true, data: row })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
  }
}

export const foundationController = {
  roles: makeHandlers(foundationService.listRoles, foundationService.getRole, 'role'),
  locations: makeHandlers(foundationService.listLocations, foundationService.getLocation, 'location'),
  departments: makeHandlers(foundationService.listDepartments, foundationService.getDepartment, 'department'),
  positions: makeHandlers(foundationService.listPositions, foundationService.getPosition, 'position'),
  costCenters: makeHandlers(foundationService.listCostCenters, foundationService.getCostCenter, 'cost center'),
  workCenters: makeHandlers(foundationService.listWorkCenters, foundationService.getWorkCenter, 'work center'),
}
