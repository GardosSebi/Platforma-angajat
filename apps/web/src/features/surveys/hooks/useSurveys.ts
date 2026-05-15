import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSurveyPublicLinkRequest, CreateSurveyRequest } from "@repo/shared-types/surveys";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { fetchPublicSurvey, surveysApi } from "../api/surveys.api";

export function useSurveysOverview() {
  return useQuery({
    queryKey: ["surveys", "overview"],
    queryFn: surveysApi.overview
  });
}

export function useSurveys() {
  return useQuery({
    queryKey: ["surveys", "list"],
    queryFn: surveysApi.listSurveys
  });
}

export function useSurveyStats(surveyId?: string) {
  return useQuery({
    queryKey: ["surveys", "stats", surveyId],
    queryFn: () => surveysApi.stats(surveyId!),
    enabled: Boolean(surveyId)
  });
}

function useRefreshSurveys() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["surveys", "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["surveys", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["surveys", "stats"] })
    ]);
  };
}

export function useCreateSurvey() {
  const refresh = useRefreshSurveys();
  return useMutation({
    mutationFn: (payload: CreateSurveyRequest) => surveysApi.createSurvey(payload),
    onSuccess: refresh
  });
}

export function useActivateSurvey() {
  const refresh = useRefreshSurveys();
  return useMutation({
    mutationFn: (id: string) => surveysApi.activateSurvey(id),
    onSuccess: refresh
  });
}

export function useCloseSurvey() {
  const refresh = useRefreshSurveys();
  return useMutation({
    mutationFn: (id: string) => surveysApi.closeSurvey(id),
    onSuccess: refresh
  });
}

export function useCreatePublicSurveyLink() {
  const refresh = useRefreshSurveys();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateSurveyPublicLinkRequest }) => surveysApi.publicLink(id, payload),
    onSuccess: refresh
  });
}

export function useSurveyForRespond(surveyId: string | undefined, enabled: boolean) {
  const session = useAuthSession();
  const userId = session?.userId;
  return useQuery({
    queryKey: ["surveys", "for-respond", userId, surveyId],
    queryFn: () => surveysApi.getForRespond(surveyId!),
    enabled: Boolean(surveyId && enabled && userId)
  });
}

export function useRespondedSurveyIds(enabled: boolean) {
  const session = useAuthSession();
  const userId = session?.userId;
  return useQuery({
    queryKey: ["surveys", "responded-ids", userId],
    queryFn: surveysApi.respondedSurveyIds,
    enabled: enabled && Boolean(userId),
    select: (data) => new Set(data.surveyIds)
  });
}

export function usePublicSurveyQuery(token: string | undefined) {
  return useQuery({
    queryKey: ["surveys", "public", token],
    queryFn: () => fetchPublicSurvey(token!),
    enabled: Boolean(token),
    retry: false
  });
}
