import { z } from "zod";

export const assignTrainingSchema = z.object({
  employeeId: z.string().min(2),
  trainingCode: z.string().min(2),
  dueDate: z.string().datetime()
});

export type AssignTrainingInput = z.infer<typeof assignTrainingSchema>;
