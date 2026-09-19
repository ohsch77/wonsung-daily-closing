import {
  redirect,
} from "next/navigation";

import SystemPerformanceOverview from "@/components/system-performance/SystemPerformanceOverview";

import type {
  SystemPerformanceBatchSummary,
} from "@/components/system-performance/SystemPerformanceOverview";

import {
  createClient,
} from "@/lib/supabase/server";


export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams:
    Promise<{
      date?: string;
    }>;
};



function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );


  const year =
    parts.find(
      (part) =>
        part.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      (part) =>
        part.type ===
        "day"
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


function normalizeReportDate(
  value: string | undefined
) {
  if (
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return value;
  }

  return getKstToday();
}


export default async function SystemPerformancePage({
  searchParams,
}: PageProps) {
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


  const params =
    await searchParams;


  const reportDate =
    normalizeReportDate(
      params.date
    );


  /*
   * 현재 로그인 사용자가
   * 활성 직원인지 한 번 더 확인합니다.
   */
  const {
    data: manager,
    error: managerError,
  } =
    await supabase
      .from("managers")
      .select(
        "id,is_active"
      )
      .eq(
        "auth_user_id",
        userId
      )
      .maybeSingle();


  if (
    managerError ||
    !manager ||
    !manager.is_active
  ) {
    redirect(
      "/closing-report"
    );
  }


  /*
   * 오늘 전산실적의
   * Draft + Applied 자료를 모두 조회합니다.
   *
   * 삭제된 과거 버전은
   * 메인 화면에 필요하지 않습니다.
   */
  const {
    data: batchData,
    error: batchError,
  } =
    await supabase
      .from(
        "system_performance_batches"
      )
      .select(
        `
          id,
          report_date,
          dataset_type,
          snapshot_type,
          version_no,
          status,
          is_current,
          row_count,
          source_method,
          source_file_name,
          source_sheet_name,
          created_at
        `
      )
      .eq(
        "report_date",
        reportDate
      )
      .in(
        "status",
        [
          "draft",
          "applied",
        ]
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );


  if (batchError) {
    console.error(
      "전산실적 조회 오류:",
      batchError
    );


    return (
      <section className="rounded-[22px] border border-[#E5E7EA] bg-white p-8">

        <p className="text-[11px] font-bold tracking-[0.12em] text-[#A50034]">
          SYSTEM PERFORMANCE
        </p>


        <h2 className="mt-2 text-[24px] font-bold tracking-[-0.03em] text-[#22252A]">
          전산실적을 불러오지 못했습니다.
        </h2>


        <p className="mt-3 text-[13px] leading-6 text-[#777C84]">
          Supabase 전산실적 테이블 연결상태와 RLS 권한을 확인해주세요.
        </p>

      </section>
    );
  }


  const batches:
    SystemPerformanceBatchSummary[] =
    (
      batchData ??
      []
    ).map(
      (batch) => ({
        id:
          String(
            batch.id
          ),

        report_date:
          String(
            batch.report_date
          ),

        dataset_type:
          String(
            batch.dataset_type
          ),

        snapshot_type:
          String(
            batch.snapshot_type
          ),

        version_no:
          Number(
            batch.version_no
          ),

        status:
          String(
            batch.status
          ),

        is_current:
          Boolean(
            batch.is_current
          ),

        row_count:
          Number(
            batch.row_count ??
            0
          ),

        source_method:
          batch.source_method ??
          null,

        source_file_name:
          batch.source_file_name ??
          null,

        source_sheet_name:
          batch.source_sheet_name ??
          null,

        created_at:
          batch.created_at ??
          null,
      })
    );


  return (
    <SystemPerformanceOverview
      reportDate={
        reportDate
      }
      batches={
        batches
      }
    />
  );
}