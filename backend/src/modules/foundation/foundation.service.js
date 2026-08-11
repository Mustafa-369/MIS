import { foundationModel } from './foundation.model.js'

export const foundationService = {
  listRoles: () => foundationModel.listRoles(),
  getRole: (id) => foundationModel.getRole(id),
  listLocations: () => foundationModel.listLocations(),
  getLocation: (id) => foundationModel.getLocation(id),
  listDepartments: () => foundationModel.listDepartments(),
  getDepartment: (id) => foundationModel.getDepartment(id),
  listPositions: () => foundationModel.listPositions(),
  getPosition: (id) => foundationModel.getPosition(id),
  listCostCenters: () => foundationModel.listCostCenters(),
  getCostCenter: (id) => foundationModel.getCostCenter(id),
  listWorkCenters: () => foundationModel.listWorkCenters(),
  getWorkCenter: (id) => foundationModel.getWorkCenter(id),
}
