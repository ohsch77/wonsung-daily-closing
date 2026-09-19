"use client";

import {
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useRouter } from "next/navigation";

import {
  BROWSER_SESSION_STORAGE_KEY,
  createClient,
} from "@/lib/supabase/client";

function subscribeToBrowserSession(
  onStoreChange: () => void
) {
  window.addEventListener(
    "storage",
    onStoreChange
  );

  return () => {
    window.removeEventListener(
      "storage",
      onStoreChange
    );
  };
}

function getBrowserSessionSnapshot() {
  return (
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(
      BROWSER_SESSION_STORAGE_KEY
    ) === "active"
  );
}

function getServerSessionSnapshot() {
  return false;
}

export default function SessionLifecycleGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const hasBrowserSession =
    useSyncExternalStore(
      subscribeToBrowserSession,
      getBrowserSessionSnapshot,
      getServerSessionSnapshot
    );

  useEffect(() => {
    let isMounted = true;

    if (!hasBrowserSession) {
      window.sessionStorage.removeItem(
        BROWSER_SESSION_STORAGE_KEY
      );

      const supabase = createClient();

      void supabase.auth
        .signOut({
          scope: "local",
        })
        .finally(() => {
          if (!isMounted) {
            return;
          }

          router.replace("/login");
          router.refresh();
        });

      return () => {
        isMounted = false;
      };
    }

    return () => {
      isMounted = false;
    };
  }, [hasBrowserSession, router]);

  if (!hasBrowserSession) {
    return null;
  }

  return <>{children}</>;
}
