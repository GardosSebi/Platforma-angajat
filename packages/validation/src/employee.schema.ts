import { z } from "zod";

export const employeeSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  active: z.boolean().default(true)
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
