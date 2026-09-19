import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import MobileNav from "@/components/layout/MobileNav";
import LogoutButton from "@/components/auth/LogoutButton";

import type {
  ManagerProfile,
} from "@/types/app";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    redirect("/login");
  }

  const {
    data: managerData,
    error: managerError,
  } =
    await supabase
      .from("managers")
      .select(
        `
          id,
          employee_no,
          name,
          role,
          is_active,
          display_order
        `
      )
      .eq(
        "auth_user_id",
        userId
      )
      .maybeSingle();

  if (
    managerError ||
    !managerData
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F6F8] px-5">

        <section className="w-full max-w-[480px] rounded-[22px] border border-[#E5E7EB] bg-white p-8 text-center shadow-sm">

          <h1 className="text-[20px] font-bold text-[#202226]">
            직원정보 연결을 확인해주세요.
          </h1>

          <p className="mt-3 text-[14px] leading-6 text-[#747981]">
            로그인 계정과 직원정보가 연결되어 있지 않습니다.
          </p>

          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>

        </section>

      </main>
    );
  }

  if (!managerData.is_active) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F6F8] px-5">

        <section className="w-full max-w-[480px] rounded-[22px] border border-[#E5E7EB] bg-white p-8 text-center shadow-sm">

          <h1 className="text-[20px] font-bold text-[#202226]">
            사용이 중지된 계정입니다.
          </h1>

          <p className="mt-3 text-[14px] leading-6 text-[#747981]">
            관리자에게 계정상태를 확인해주세요.
          </p>

          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>

        </section>

      </main>
    );
  }

  const manager =
    managerData as ManagerProfile;

  return (
    <div className="min-h-screen bg-[#F6F7F9]">

      <AppSidebar
        manager={manager}
      />

      <div className="min-h-screen lg:pl-[264px]">

        <AppHeader
          manager={manager}
        />

        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-7 lg:pb-10">
          {children}
        </main>

      </div>

      <MobileNav
        manager={manager}
      />

    </div>
  );
}