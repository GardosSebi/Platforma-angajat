import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { pushApi } from "../api/push.api";
import { subscribeToPush } from "../../pwa/sw";

export type PushNotificationStatus = "idle" | "pending" | "enabled" | "denied" | "unsupported" | "error";

export function usePushNotifications() {
  const [status, setStatus] = useState<PushNotificationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSupported = useMemo(
    () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window,
    []
  );

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!isSupported) {
        throw new Error("unsupported");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("denied");
      }

      const { vapidPublicKey } = await pushApi.getVapidPublicKey();
      const subscription = await subscribeToPush(vapidPublicKey);
      await pushApi.subscribe(subscription);
      return subscription;
    },
    onMutate: () => {
      setStatus("pending");
      setErrorMessage(null);
    },
    onSuccess: () => {
      setStatus("enabled");
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        if (error.message === "denied") {
          setStatus("denied");
          return;
        }
        if (error.message === "unsupported") {
          setStatus("unsupported");
          return;
        }
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unknown error");
      }
      setStatus("error");
    }
  });

  const enable = useCallback(() => {
    enableMutation.mutate();
  }, [enableMutation]);

  return {
    enable,
    status,
    errorMessage,
    isSupported,
    isPending: enableMutation.isPending
  };
}
