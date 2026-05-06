export const SSM_TRAINING_REPOSITORY = "SSM_TRAINING_REPOSITORY";

export interface AssignTrainingInput {
  tenantId: string;
  employeeId: string;
  trainingCode: string;
  dueDate: Date;
  assignedBy: string;
}

export interface SsmTrainingRepository {
  assignTraining(input: AssignTrainingInput): Promise<{ id: string }>;
}
