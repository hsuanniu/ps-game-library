"use client";

import { useCallback, useState } from "react";

export interface ToastMessage {
  id: string;
  title: string;
  tone?: "success" | "danger" | "neutral";
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}`;
    setToasts((current) => [...current, { ...toast, id }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
  };
}
