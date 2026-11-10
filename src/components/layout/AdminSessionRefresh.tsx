"use client";

import { useEffect } from "react";
import { refreshCloudSession } from "@/lib/storage/gameCloudStorage";

export function AdminSessionRefresh() {
  useEffect(() => {
    let refreshing = false;

    function refresh() {
      if (refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      void refreshCloudSession().catch(() => {
        // Renewal is optional when offline or signed out; normal sync reports auth errors.
      }).finally(() => {
        refreshing = false;
      });
    }

    function resume(event: PageTransitionEvent) {
      if (event.persisted) refresh();
    }

    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", refresh);
    };
  }, []);

  return null;
}
