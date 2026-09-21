import { useQuery } from "@tanstack/react-query";
import { ssmApi } from "../api/ssm.api";

export function useManagerTeam() {
  return useQuery({
    queryKey: ["ssm", "manager", "team"],
    queryFn: ssmApi.managerTeam
  });
}
