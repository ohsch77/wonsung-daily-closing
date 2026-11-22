import { getRequestClaims, getRequestManager } from "@/lib/supabase/request-cache";
import type {
  ReactNode,
} from "react";

import {
  redirect,
} from "next/navigation";



export const dynamic =
  "force-dynamic";


type Props = {
  children: ReactNode;
};


export default async function AdminLayout({
  children,
}: Props) {
  const {
    data: claimsData,
    error: claimsError,
  } =
    await getRequestClaims();

  const userId =
    claimsData?.claims?.sub;

  if (
    claimsError ||
    !userId
  ) {
    redirect(
      "/login"
    );
  }

  const {
    data: manager,
    error: managerError,
  } =
    await getRequestManager(userId);

  if (
    managerError ||
    !manager ||
    !manager.is_active ||
    manager.role !== "admin"
  ) {
    redirect(
      "/closing-report"
    );
  }

  return children;
}
