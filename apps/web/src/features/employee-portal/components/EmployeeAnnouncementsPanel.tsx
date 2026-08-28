import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommunicationReaction } from "@repo/shared-types/communications";
import { COMMUNICATION_REACTION_LABELS } from "@repo/shared-types/communications";
import { chatbotApi } from "../../chatbot/api/chatbot.api";
import { CommsMediaPreview } from "../../chatbot/components/CommsMediaPreview";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { formatRoDateTime, mutationErrorMessage } from "../utils";
import { resolveAnnouncementText } from "../../chatbot/comms-shared";

const REACTIONS: CommunicationReaction[] = ["THUMBS_UP", "HEART", "CLAP", "CHECK"];

export function EmployeeAnnouncementsPanel() {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["employee-portal", "announcements"],
    queryFn: () => chatbotApi.listAnnouncements({ page: 1, pageSize: 30, forMe: true })
  });

  const markRead = useMutation({
    mutationFn: (announcementId: string) =>
      chatbotApi.markAnnouncementRead(announcementId, { employeeId: employeeId! }),
    onSuccess: async () => {
      setFeedback("Marcat ca citit.");
      await queryClient.invalidateQueries({ queryKey: ["employee-portal", "announcements"] });
    },
    onError: (error: unknown) => setFeedback(mutationErrorMessage(error))
  });

  const setReaction = useMutation({
    mutationFn: ({ announcementId, reaction }: { announcementId: string; reaction: CommunicationReaction }) =>
      chatbotApi.setAnnouncementReaction(announcementId, { employeeId: employeeId!, reaction }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee-portal", "announcements"] });
    }
  });

  const submitAnswer = useMutation({
    mutationFn: ({ announcementId, answerText }: { announcementId: string; answerText: string }) =>
      chatbotApi.submitAnnouncementAnswer(announcementId, { employeeId: employeeId!, answerText }),
    onSuccess: async (_data, variables) => {
      setFeedback("Răspuns trimis.");
      setAnswerDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.announcementId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["employee-portal", "announcements"] });
    },
    onError: (error: unknown) => setFeedback(mutationErrorMessage(error))
  });

  const published = (query.data?.items ?? []).filter((a) => a.status === "PUBLISHED");

  if (query.isLoading) {
    return <p className="field-hint">Se încarcă anunțurile…</p>;
  }

  if (query.isError) {
    return <p className="feedback error">{mutationErrorMessage(query.error)}</p>;
  }

  if (!published.length) {
    return (
      <div className="employee-portal-empty card">
        <p>Nu există anunțuri active pentru tine.</p>
      </div>
    );
  }

  const onAnswerSubmit = (event: FormEvent, announcementId: string) => {
    event.preventDefault();
    const answerText = (answerDrafts[announcementId] ?? "").trim();
    if (!answerText || !employeeId) return;
    submitAnswer.mutate({ announcementId, answerText });
  };

  return (
    <div className="employee-portal-announcements">
      {!employeeId ? (
        <p className="feedback error">Nu putem înregistra citirea fără profil angajat asociat.</p>
      ) : null}
      {feedback ? <p className="field-hint">{feedback}</p> : null}
      <ul className="employee-announcement-list">
        {published.map((item) => {
          const needsRead = item.requireReadConfirmation || item.messageType === "READ_CONFIRMATION";
          const isUnread = item.myRead !== true;
          const text = resolveAnnouncementText(item);
          const isQuestion = item.messageType === "QUESTION";
          return (
            <li key={item.id} className="card employee-announcement-item">
              <header>
                <strong>{text.title}</strong>
                <span className="field-hint">{formatRoDateTime(item.publishAt ?? item.createdAt)}</span>
              </header>
              {isQuestion ? <span className="ssm-chip warn">Întrebare</span> : null}
              <p className="employee-announcement-body">{text.body}</p>
              {item.contentUrl ? (
                <CommsMediaPreview contentUrl={item.contentUrl} contentType={item.contentType} />
              ) : null}
              {item.contentType === "BUTTON" && item.buttonUrl ? (
                <p>
                  <a href={item.buttonUrl} target="_blank" rel="noreferrer" className="btn-primary">
                    {item.buttonLabel ?? "Deschide"}
                  </a>
                </p>
              ) : null}
              {item.linkedSurveyId ? (
                <p>
                  <Link className="btn-secondary" to={`/surveys/respond/${item.linkedSurveyId}`}>
                    Completează sondajul
                  </Link>
                </p>
              ) : null}
              {item.contentType === "SURVEY" && !item.linkedSurveyId ? (
                <p className="field-hint">Acest anunț conține un sondaj — vezi tab-ul Sondaje.</p>
              ) : null}

              {isQuestion && employeeId ? (
                item.myAnswer ? (
                  <div className="comms-my-answer">
                    <p className="field-hint">Răspunsul tău</p>
                    <p className="employee-announcement-body">{item.myAnswer.answerText}</p>
                  </div>
                ) : (
                  <form
                    className="comms-answer-form"
                    onSubmit={(event) => onAnswerSubmit(event, item.id)}
                  >
                    <label htmlFor={`answer-${item.id}`}>Răspunsul tău</label>
                    <textarea
                      id={`answer-${item.id}`}
                      rows={3}
                      value={answerDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setAnswerDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                      }
                      placeholder="Scrie răspunsul…"
                      required
                    />
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={submitAnswer.isPending || !(answerDrafts[item.id] ?? "").trim()}
                    >
                      Trimite răspunsul
                    </button>
                  </form>
                )
              ) : null}

              {!isQuestion && employeeId && needsRead && isUnread ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(item.id)}
                >
                  Confirmă citirea *
                </button>
              ) : !isQuestion && employeeId && isUnread ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(item.id)}
                >
                  Confirm citire
                </button>
              ) : !isQuestion && employeeId && !isUnread ? (
                <span className="ssm-chip good">Citit</span>
              ) : null}
              {item.reactionsEnabled && employeeId ? (
                <div className="comms-reactions" role="group" aria-label="Reacții">
                  {REACTIONS.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      className="comms-reaction-btn"
                      disabled={setReaction.isPending}
                      onClick={() => setReaction.mutate({ announcementId: item.id, reaction })}
                    >
                      {COMMUNICATION_REACTION_LABELS[reaction]}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
