-- One authenticated response per user per survey (NULL respondentUserId = public/anonymous).
DELETE FROM "SurveyResponse" a
USING "SurveyResponse" b
WHERE a."surveyId" = b."surveyId"
  AND a."respondentUserId" IS NOT NULL
  AND a."respondentUserId" = b."respondentUserId"
  AND a."submittedAt" > b."submittedAt";

CREATE UNIQUE INDEX "SurveyResponse_surveyId_respondentUserId_key" ON "SurveyResponse"("surveyId", "respondentUserId");
