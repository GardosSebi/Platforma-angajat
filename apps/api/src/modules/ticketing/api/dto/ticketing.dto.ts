import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

const TICKET_STATUSES = ["OPEN", "WAITING_OPERATOR", "WAITING_USER", "WAITING_INFO", "CLOSED"] as const;
const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const TICKET_SOURCES = ["PORTAL", "SURVEY", "CHATBOT", "EMAIL", "MANUAL"] as const;

type TicketStatusCode = (typeof TICKET_STATUSES)[number];
type TicketPriorityCode = (typeof TICKET_PRIORITIES)[number];
type TicketSourceCode = (typeof TICKET_SOURCES)[number];

export class ListTicketsDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatusCode;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriorityCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reporterEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assignedToName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriorityCode;

  @IsOptional()
  @IsIn(TICKET_SOURCES)
  source?: TicketSourceCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reporterEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  reporterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reporterEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assignedToName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceSurveyResponseId?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: TicketStatusCode;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriorityCode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reporterEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  reporterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reporterEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assignedToName?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class MoveTicketDto {
  @IsIn(TICKET_STATUSES)
  status!: TicketStatusCode;
}

export class AssignTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  assignedToUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  assignedToName?: string;
}

export class AddTicketCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(3000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

export class CreateTicketFromEmailDto {
  @IsString()
  @MinLength(3)
  @MaxLength(320)
  fromEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  fromName?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsIn(TICKET_PRIORITIES)
  priority?: TicketPriorityCode;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  messageId?: string;
}
