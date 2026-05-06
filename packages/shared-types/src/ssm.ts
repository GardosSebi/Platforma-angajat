export interface AssignTrainingRequest {
  employeeId: string;
  trainingCode: string;
  dueDate: string;
}

export interface AssignTrainingResponse {
  assignmentId: string;
}
