import { FormEvent, useMemo, useState } from "react";
import {
  EXTERNAL_CONTACT_KIND_LABELS,
  EXTERNAL_CONTACT_KINDS,
  type CreateExternalContactRequest,
  type ExternalContactKind
} from "@repo/shared-types/communication-rights";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { formatCommsDate, mutationErrorMessage } from "../comms-shared";
import {
  useChatChannels,
  useChatMessages,
  useCreateExternalContact,
  useDeactivateExternalContact,
  useExternalContacts,
  usePostChatMessage
} from "../hooks/useChatbot";

const EMPTY_CONTACT: CreateExternalContactRequest = {
  kind: "PARTNER",
  organization: "",
  fullName: "",
  email: "",
  phone: "",
  notes: ""
};

type Props = {
  canManageContacts: boolean;
};

export function CommsChatPanel({ canManageContacts }: Props) {
  const channelsQuery = useChatChannels();
  const contactsQuery = useExternalContacts();
  const createContact = useCreateExternalContact();
  const deactivateContact = useDeactivateExternalContact();

  const [channelId, setChannelId] = useState("");
  const [draft, setDraft] = useState("");
  const [contactForm, setContactForm] = useState<CreateExternalContactRequest>(EMPTY_CONTACT);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const channels = channelsQuery.data?.items ?? [];
  const selectedId = channelId || channels[0]?.id || "";
  const selected = channels.find((item) => item.id === selectedId) ?? channels[0];
  const messagesQuery = useChatMessages(selectedId, Boolean(selectedId));
  const postMessage = usePostChatMessage(selectedId);

  const contacts = contactsQuery.data?.items ?? [];

  const kindOptions = useMemo(
    () => EXTERNAL_CONTACT_KINDS.map((kind) => ({ value: kind, label: EXTERNAL_CONTACT_KIND_LABELS[kind] })),
    []
  );

  const onSend = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    postMessage.mutate(draft.trim(), {
      onSuccess: () => setDraft(""),
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const onCreateContact = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    createContact.mutate(
      {
        ...contactForm,
        organization: contactForm.organization.trim(),
        fullName: contactForm.fullName.trim(),
        email: contactForm.email.trim(),
        phone: contactForm.phone?.trim() || undefined,
        notes: contactForm.notes?.trim() || undefined
      },
      {
        onSuccess: () => {
          setContactForm(EMPTY_CONTACT);
          setFeedback({ type: "success", message: "Contact extern adăugat. Poți scrie pe canalul lui." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  return (
    <div className="form-stack">
      <div className="card form-stack comms-panel">
        <h2 className="card-title">Chat companie / grup și comunicare externă</h2>
        <p className="comms-toolbar-hint">
          Canale interne pe companie sau grup, plus trimitere către contractori și parteneri (email în afara firmei).
        </p>
        {channelsQuery.isLoading ? <p className="field-hint">Se încarcă canalele…</p> : null}
        {!channelsQuery.isLoading && channels.length === 0 ? (
          <p className="field-hint">
            Nu ai încă drept de chat. Cere administratorului un drept pe companie/grup sau comunicare externă.
          </p>
        ) : null}
        {channels.length > 0 ? (
          <div className="comms-chat-layout">
            <div className="ssm-history-list">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  className={`ssm-history-item ssm-overview-select-row${selectedId === channel.id ? " selected" : ""}`}
                  onClick={() => setChannelId(channel.id)}
                >
                  <div>
                    <strong>{channel.name}</strong>
                    <div className="field-hint">
                      {channel.kind === "EXTERNAL" ? "Extern" : channel.kind === "COMPANY" ? "Companie" : channel.kind === "GROUP" ? "Grup" : channel.kind === "WORKSITE" ? "Punct" : "Organizație"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="form-stack">
              <h3 className="card-title" style={{ margin: 0 }}>
                {selected?.name ?? "Canal"}
              </h3>
              {selected?.kind === "EXTERNAL" ? (
                <p className="field-hint">Mesajele se trimit și pe email către {selected.externalContact?.email}.</p>
              ) : (
                <p className="field-hint">Chat intern pe scopul acordat.</p>
              )}
              <div className="comms-chat-messages">
                {(messagesQuery.data?.items ?? []).map((message) => (
                  <div key={message.id} className={`comms-chat-bubble${message.mine ? " mine" : ""}`}>
                    <strong>{message.authorName}</strong>
                    <div>{message.body}</div>
                    <div className="field-hint">
                      {formatCommsDate(message.createdAt)}
                      {message.emailedTo ? ` · trimis la ${message.emailedTo}` : ""}
                    </div>
                  </div>
                ))}
                {!messagesQuery.isLoading && !(messagesQuery.data?.items ?? []).length ? (
                  <p className="field-hint">Niciun mesaj încă.</p>
                ) : null}
              </div>
              <form className="form-stack" onSubmit={onSend}>
                <div className="field">
                  <label htmlFor="chat-body">Mesaj</label>
                  <textarea
                    id="chat-body"
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={selected?.kind === "EXTERNAL" ? "Scrie către partener/contractant…" : "Scrie un mesaj intern…"}
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={postMessage.isPending || !draft.trim()}>
                  {postMessage.isPending ? "Se trimite…" : selected?.kind === "EXTERNAL" ? "Trimite în afara firmei" : "Trimite"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      {canManageContacts ? (
        <form className="card form-stack comms-panel" onSubmit={onCreateContact}>
          <h3 className="card-title">Contacte externe (contractori / parteneri)</h3>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Destinatari din afara firmei pentru chat și anunțuri cu audiență „Extern”.
          </p>
          <div className="comms-form-row">
            <FieldSelect
              id="ext-kind"
              label="Tip"
              value={contactForm.kind ?? "PARTNER"}
              onChange={(kind) => setContactForm((prev) => ({ ...prev, kind: kind as ExternalContactKind }))}
              options={kindOptions}
            />
            <div className="field">
              <label htmlFor="ext-org">Organizație *</label>
              <input
                id="ext-org"
                value={contactForm.organization}
                onChange={(event) => setContactForm((prev) => ({ ...prev, organization: event.target.value }))}
                required
              />
            </div>
          </div>
          <div className="comms-form-row">
            <div className="field">
              <label htmlFor="ext-name">Nume *</label>
              <input
                id="ext-name"
                value={contactForm.fullName}
                onChange={(event) => setContactForm((prev) => ({ ...prev, fullName: event.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="ext-email">Email *</label>
              <input
                id="ext-email"
                type="email"
                value={contactForm.email}
                onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={createContact.isPending}>
            {createContact.isPending ? "Se salvează…" : "Adaugă contact extern"}
          </button>
          <ul className="list-plain">
            {contacts.map((contact) => (
              <li key={contact.id} className="list-row">
                <div>
                  <strong>
                    {contact.fullName} — {contact.organization}
                  </strong>
                  <span className="muted">
                    {" "}
                    · {EXTERNAL_CONTACT_KIND_LABELS[contact.kind]} · {contact.email}
                    {contact.active ? "" : " · inactiv"}
                  </span>
                </div>
                {contact.active ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => deactivateContact.mutate(contact.id)}
                  >
                    Dezactivează
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </form>
      ) : null}

      {feedback ? (
        <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}