import type {
  ReactNode,
} from "react";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";


type Props = {
  children: ReactNode;
};


export default async function AdminLayout({
  children,
}: Props) {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth
      .getClaims();

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
    await supabase
      .from("managers")
      .select(
        "id,role,is_active"
      )
      .eq(
        "auth_user_id",
        userId
      )
      .maybeSingle();

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
