import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import LoginForm from "./LoginForm";


export default async function LoginPage() {
  const supabase =
    await createClient();


  /*
   * 이미 정상 로그인된 사용자는
   * 로그인 화면을 다시 보여주지 않음
   */
  const {
    data: claimsData,
  } =
    await supabase.auth
      .getClaims();


  if (
    claimsData?.claims?.sub
  ) {
    redirect(
      "/closing-report"
    );
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F6F8] px-5 py-10">
      <div className="w-full max-w-[430px]">

        <div className="mb-8 text-center">

          <div className="mb-3 text-[12px] font-bold tracking-[0.18em] text-[#A50034]">
            WONSUNG DAILY
          </div>

          <h1 className="text-[30px] font-bold tracking-[-0.04em] text-[#17191D]">
            원성점 일마감
          </h1>

          <p className="mt-3 text-[14px] leading-6 text-[#777C85]">
            일일실적 · 전산실적 · 카드 · 마감보고
          </p>

        </div>


        <section className="rounded-[24px] border border-[#E7E9ED] bg-white p-7 shadow-[0_18px_50px_rgba(0,0,0,0.06)] sm:p-8">

          <LoginForm />

        </section>


        <p className="mt-6 text-center text-[12px] text-[#9A9EA6]">
          LG전자 베스트샵 원성점
        </p>

      </div>
    </main>
  );
}