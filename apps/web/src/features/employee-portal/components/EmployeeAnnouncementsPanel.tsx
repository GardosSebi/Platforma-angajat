import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CommunicationReaction } from "@repo/shared-types/communications";
import { COMMUNICATION_REACTION_LABELS } from "@repo/shared-types/communications";
import { chatbotApi } from "../../chatbot/api/chatbot.api";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { formatRoDateTime, mutationErrorMessage } from "../utils";

const REACTIONS: CommunicationReaction[] = ["THUMBS_UP", "HEART", "CLAP", "CHECK"];

export function EmployeeAnnouncementsPanel() {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["employee-portal", "announcements"],
    queryFn: () => chatbotApi.listAnnouncements({ page: 1, pageSize: 30 })
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

  return (
    <div className="employee-portal-announcements">
      {!employeeId ? (
        <p className="feedback error">Nu putem înregistra citirea fără profil angajat asociat.</p>
      ) : null}
      {feedback ? <p className="field-hint">{feedback}</p> : null}
      <ul className="employee-announcement-list">
        {published.map((item) => {
          const needsRead = item.requireReadConfirmation || item.messageType === "READ_CONFIRMATION";
          const isUnread = item.stats.unreadCount > 0;
          return (
            <li key={item.id} className="card employee-announcement-item">
              <header>
                <strong>{item.title}</strong>
                <span className="field-hint">{formatRoDateTime(item.publishAt ?? item.createdAt)}</span>
              </header>
              <p className="employee-announcement-body">{item.body}</p>
              {item.contentType === "IMAGE" && item.contentUrl ? (
                <img src={item.contentUrl} alt="" className="employee-announcement-media" />
              ) : null}
              {item.contentType === "VIDEO" && item.contentUrl ? (
                <video src={item.contentUrl} controls className="employee-announcement-media" />
              ) : null}
              {item.contentUrl && item.contentType !== "IMAGE" && item.contentType !== "VIDEO" ? (
                <p>
                  <a href={item.contentUrl} target="_blank" rel="noreferrer" className="btn-text-link">
                    Deschide atașamentul
                  </a>
                </p>
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
              {employeeId && needsRead && isUnread ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(item.id)}
                >
                  Confirmă citirea *
                </button>
              ) : employeeId && isUnread ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(item.id)}
                >
                  Confirm citire
                </button>
              ) : item.stats.readCount > 0 ? (
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
