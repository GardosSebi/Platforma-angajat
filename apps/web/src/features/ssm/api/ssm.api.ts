import type { AssignTrainingRequest, AssignTrainingResponse } from "@repo/shared-types/ssm";
import { httpClient } from "../../../shared/api/http-client";

export const ssmApi = {
  assignTraining(payload: AssignTrainingRequest) {
    return httpClient<AssignTrainingResponse>("/ssm/trainings/assign", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
