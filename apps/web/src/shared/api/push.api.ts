import { httpClient } from "./http-client";

export type PushSubscribePayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export const pushApi = {
  getVapidPublicKey() {
    return httpClient<{ vapidPublicKey: string }>("/notifications/push/vapid-public-key");
  },
  subscribe(payload: PushSubscribePayload) {
    return httpClient<{ subscribed: boolean }>("/notifications/push/subscribe", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  unsubscribe(endpoint: string) {
    return httpClient<{ unsubscribed: boolean }>("/notifications/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint })
    });
  }
};
