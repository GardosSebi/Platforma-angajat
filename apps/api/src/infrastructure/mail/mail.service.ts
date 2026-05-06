import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { AppLoggerService } from "../logging/app-logger.service";

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly logger: AppLoggerService) {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.transporter = null;
      this.logger.log("SMTP_HOST not set; MailService is disabled", "Mail");
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined
    });
  }

  async sendMail(options: { to: string; subject: string; text: string; html?: string }) {
    if (!this.transporter) {
      this.logger.log(JSON.stringify({ skipped: true, to: options.to, subject: options.subject }), "Mail");
      return { sent: false, reason: "smtp_disabled" };
    }
    const from = process.env.SMTP_FROM ?? "no-reply@localhost";
    await this.transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    return { sent: true };
  }
}
