import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ssmApi } from "../api/ssm.api";

export function useAssignTraining() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ssmApi.assignTraining,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ssm", "assignments"] });
    }
  });
}
