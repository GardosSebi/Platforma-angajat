import type { EmployeeDirectoryResponse, EmployeeMyContextResponse } from "@repo/shared-types";
import { httpClient } from "../../../shared/api/http-client";

export const employeeStaticApi = {
  getMyContext() {
    return httpClient<EmployeeMyContextResponse>("/platform/employee-static/my-context");
  },
  getDirectory() {
    return httpClient<EmployeeDirectoryResponse>("/platform/employee-static/directory");
  }
};
