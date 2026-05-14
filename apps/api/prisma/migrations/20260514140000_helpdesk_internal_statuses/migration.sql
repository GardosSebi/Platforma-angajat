-- Help desk intern: stări Kanban (4.4) — mapare de la enum vechi la noul flux
CREATE TYPE "HelpdeskTicketStatus_new" AS ENUM ('OPEN', 'WAITING_OPERATOR', 'WAITING_USER', 'WAITING_INFO', 'CLOSED');

ALTER TABLE "HelpdeskTicket" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "HelpdeskTicket" ALTER COLUMN "status" TYPE "HelpdeskTicketStatus_new" USING (
  CASE "status"::text
    WHEN 'NEW' THEN 'OPEN'::"HelpdeskTicketStatus_new"
    WHEN 'TRIAGE' THEN 'WAITING_OPERATOR'::"HelpdeskTicketStatus_new"
    WHEN 'IN_PROGRESS' THEN 'WAITING_OPERATOR'::"HelpdeskTicketStatus_new"
    WHEN 'WAITING_REQUESTER' THEN 'WAITING_USER'::"HelpdeskTicketStatus_new"
    WHEN 'RESOLVED' THEN 'WAITING_INFO'::"HelpdeskTicketStatus_new"
    WHEN 'CLOSED' THEN 'CLOSED'::"HelpdeskTicketStatus_new"
    ELSE 'OPEN'::"HelpdeskTicketStatus_new"
  END
);

ALTER TABLE "HelpdeskTicket" ALTER COLUMN "status" SET DEFAULT 'OPEN'::"HelpdeskTicketStatus_new";

DROP TYPE "HelpdeskTicketStatus";

ALTER TYPE "HelpdeskTicketStatus_new" RENAME TO "HelpdeskTicketStatus";

ALTER TABLE "HelpdeskTicket" ALTER COLUMN "status" SET DEFAULT 'OPEN'::"HelpdeskTicketStatus";
