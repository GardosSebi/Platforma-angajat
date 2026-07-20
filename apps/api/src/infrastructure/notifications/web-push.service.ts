import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as webpush from "web-push";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey: string | null;
  private readonly privateKey: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    this.publicKey = this.config.get<string>("VAPID_PUBLIC_KEY")?.trim() || null;
    this.privateKey = this.config.get<string>("VAPID_PRIVATE_KEY")?.trim() || null;
    const subject = this.config.get<string>("VAPID_SUBJECT")?.trim() || "mailto:admin@company.local";
    if (this.publicKey && this.privateKey) {
      webpush.setVapidDetails(subject, this.publicKey, this.privateKey);
    } else {
      this.logger.warn("VAPID keys not set; web push is disabled");
    }
  }

  getPublicKey() {
    return {
      publicKey: this.publicKey,
      enabled: Boolean(this.publicKey && this.privateKey)
    };
  }

  async subscribe(
    tenantId: string,
    userId: string,
    input: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { tenantId_endpoint: { tenantId, endpoint: input.endpoint } },
      create: {
        tenantId,
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent
      }
    });
  }

  async unsubscribe(tenantId: string, userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { tenantId, userId, endpoint }
    });
    return { deleted: true };
  }

  async sendToUser(
    tenantId: string,
    userId: string,
    payload: { title: string; body: string; linkPath?: string }
  ) {
    if (!this.publicKey || !this.privateKey) return { sent: 0 };

    const subs = await this.prisma.pushSubscription.findMany({ where: { tenantId, userId } });
    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          this.logger.warn(`Push failed for ${sub.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return { sent };
  }
}
