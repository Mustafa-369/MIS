import { workforceModel } from './workforce.model.js'

export const workforceService = {
  listCapabilities: () => workforceModel.listCapabilities(),
  getCapability: (id) => workforceModel.getCapability(id),

  listEmployees: () => workforceModel.listEmployees(),
  getEmployee: (id) => workforceModel.getEmployee(id),
  createEmployee: (data) => workforceModel.createEmployee(data),

  listAppUsers: () => workforceModel.listAppUsers(),
  getAppUser: (id) => workforceModel.getAppUser(id),
  createAppUser: (data) => workforceModel.createAppUser(data),

  listMachines: () => workforceModel.listMachines(),
  getMachine: (id) => workforceModel.getMachine(id),

  listEmployeePositions: () => workforceModel.listEmployeePositions(),
  getEmployeePositionsByEmployee: (employeeId) => workforceModel.getEmployeePositionsByEmployee(employeeId),
  createEmployeePosition: (data) => workforceModel.createEmployeePosition(data),
}
