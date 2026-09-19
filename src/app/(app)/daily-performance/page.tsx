import {
  redirect,
} from "next/navigation";

import DailyPerformanceWorkspace from "@/components/daily/DailyPerformanceWorkspace";

import {
  normalizeCategoryRows,
  normalizeMetricRows,
} from "@/lib/daily-performance";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  DailyManager,
} from "@/lib/daily-performance";


export const dynamic =
  "force-dynamic";


function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "한국 날짜를 계산할 수 없습니다."
    );
  }

  return `${year}-${month}-${day}`;
}


export default async function DailyPerformancePage() {
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


  const [
    managersResult,
    currentManagerResult,
    categoriesResult,
    metricsResult,
  ] =
    await Promise.all([
      supabase
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
          "is_active",
          true
        )
        .order(
          "display_order",
          {
            ascending: true,
          }
        ),

      supabase
        .from("managers")
        .select(
          "id,is_active"
        )
        .eq(
          "auth_user_id",
          userId
        )
        .maybeSingle(),

      supabase
        .from(
          "metric_categories"
        )
        .select("*"),

      supabase
        .from(
          "metrics"
        )
        .select("*"),
    ]);


  if (
    managersResult.error ||
    currentManagerResult.error ||
    categoriesResult.error ||
    metricsResult.error
  ) {
    return (
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-8">

        <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
          DAILY PERFORMANCE
        </p>

        <h2 className="mt-2 text-[24px] font-bold text-[#22252A]">
          일실적 데이터를 불러오지 못했습니다.
        </h2>

        <p className="mt-3 text-[13px] leading-6 text-[#777C84]">
          Supabase 연결상태와 일실적 관련 테이블 권한을 확인해주세요.
        </p>

      </section>
    );
  }


  if (
    !currentManagerResult.data ||
    !currentManagerResult.data
      .is_active
  ) {
    redirect(
      "/closing-report"
    );
  }


  const managers:
    DailyManager[] =
    (
      managersResult.data ??
      []
    ).map(
      (
        manager,
        index
      ) => ({
        id:
          manager.id,

        employeeNo:
          manager.employee_no,

        name:
          manager.name,

        role:
          manager.role ===
          "admin"
            ? "admin"
            : "manager",

        displayOrder:
          manager.display_order ??
          index + 1,
      })
    );


  const categories =
    normalizeCategoryRows(
      categoriesResult.data ??
        []
    );


  const metrics =
    normalizeMetricRows(
      metricsResult.data ??
        []
    );


  return (
    <DailyPerformanceWorkspace
      managers={
        managers
      }
      categories={
        categories
      }
      metrics={
        metrics
      }
      currentManagerId={
        currentManagerResult
          .data.id
      }
      currentUserId={
        userId
      }
      today={
        getKstToday()
      }
    />
  );
}