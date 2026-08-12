import { workforceService } from './workforce.service.js'

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

function requireFields(body, fields) {
  return fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '')
}

export const workforceController = {
  capabilities: makeHandlers(workforceService.listCapabilities, workforceService.getCapability, 'capability'),

  employees: {
    ...makeHandlers(workforceService.listEmployees, workforceService.getEmployee, 'employee'),
    create: async (req, res) => {
      const missing = requireFields(req.body, ['code', 'full_name'])
      if (missing.length) {
        res.status(400).json({ ok: false, error: `missing fields: ${missing.join(', ')}` })
        return
      }
      try {
        const row = await workforceService.createEmployee(req.body)
        res.status(201).json({ ok: true, data: row })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
  },

  appUsers: {
    ...makeHandlers(workforceService.listAppUsers, workforceService.getAppUser, 'app user'),
    create: async (req, res) => {
      const missing = requireFields(req.body, ['employee_id', 'username'])
      if (missing.length) {
        res.status(400).json({ ok: false, error: `missing fields: ${missing.join(', ')}` })
        return
      }
      try {
        const row = await workforceService.createAppUser(req.body)
        res.status(201).json({ ok: true, data: row })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
  },

  machines: makeHandlers(workforceService.listMachines, workforceService.getMachine, 'machine'),

  employeePositions: {
    list: async (req, res) => {
      try {
        const rows = await workforceService.listEmployeePositions()
        res.json({ ok: true, data: rows })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
    getByEmployee: async (req, res) => {
      try {
        const rows = await workforceService.getEmployeePositionsByEmployee(req.params.employeeId)
        res.json({ ok: true, data: rows })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
    create: async (req, res) => {
      const missing = requireFields(req.body, ['employee_id', 'job_position_id'])
      if (missing.length) {
        res.status(400).json({ ok: false, error: `missing fields: ${missing.join(', ')}` })
        return
      }
      try {
        const rows = await workforceService.createEmployeePosition(req.body)
        res.status(201).json({ ok: true, data: rows })
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
      }
    },
  },
}
