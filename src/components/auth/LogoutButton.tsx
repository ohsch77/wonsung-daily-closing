"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import {
  BROWSER_SESSION_STORAGE_KEY,
  createClient,
} from "@/lib/supabase/client";


export default function LogoutButton() {
  const router =
    useRouter();

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);


  const handleLogout =
    async () => {

      if (isLoading) {
        return;
      }


      setIsLoading(true);


      try {
        window.sessionStorage.removeItem(
          BROWSER_SESSION_STORAGE_KEY
        );

        const supabase =
          createClient();


        await supabase.auth
          .signOut();


        router.replace(
          "/login"
        );

        router.refresh();

      } finally {
        setIsLoading(false);
      }
    };


  return (
    <button
      type="button"
      onClick={
        handleLogout
      }
      disabled={
        isLoading
      }
      className="rounded-[10px] border border-[#DFE2E6] bg-white px-4 py-2 text-[13px] font-semibold text-[#555A62] transition hover:bg-[#F6F7F8] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading
        ? "로그아웃 중..."
        : "로그아웃"}
    </button>
  );
}
