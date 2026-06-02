import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatbotApi } from "../../chatbot/api/chatbot.api";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { formatRoDateTime, mutationErrorMessage } from "../utils";

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
        {published.map((item) => (
          <li key={item.id} className="card employee-announcement-item">
            <header>
              <strong>{item.title}</strong>
              <span className="field-hint">{formatRoDateTime(item.publishAt ?? item.createdAt)}</span>
            </header>
            <p className="employee-announcement-body">{item.body}</p>
            {item.contentUrl ? (
              <p>
                <a href={item.contentUrl} target="_blank" rel="noreferrer" className="btn-text-link">
                  Deschide atașamentul
                </a>
              </p>
            ) : null}
            {item.contentType === "SURVEY" ? (
              <p className="field-hint">Acest anunț conține un sondaj — vezi tab-ul Sondaje.</p>
            ) : null}
            {employeeId && item.stats.unreadCount > 0 ? (
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
          </li>
        ))}
      </ul>
    </div>
  );
}
