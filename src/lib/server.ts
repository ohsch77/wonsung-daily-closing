import {
  createClient,
} from "@/lib/supabase/server";

import {
  buildPerformanceSnapshot,
  normalizeCategories,
  normalizeManagers,
  normalizeMetrics,
  normalizeMetricValues,
  normalizeReports,
} from "@/lib/analytics/performance";

import type {
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";

const PAGE_SIZE = 1000;
const REPORT_BATCH_SIZE = 200;

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function isAdminRole(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "admin";
}

export function validateAnalysisRange(
  startDate: string,
  endDate: string
) {
  if (
    !isYmd(startDate) ||
    !isYmd(endDate)
  ) {
    throw new Error(
      "조회기간 형식이 올바르지 않습니다."
    );
  }

  if (startDate > endDate) {
    throw new Error(
      "조회 시작일은 종료일보다 늦을 수 없습니다."
    );
  }

  const start =
    Date.parse(
      `${startDate}T00:00:00Z`
    );

  const end =
    Date.parse(
      `${endDate}T00:00:00Z`
    );

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end)
  ) {
    throw new Error(
      "조회기간을 확인해주세요."
    );
  }

  const days =
    Math.floor(
      (end - start) /
        86400000
    );

  if (days > 3660) {
    throw new Error(
      "한 번에 조회할 수 있는 기간은 최대 10년입니다."
    );
  }
}

async function fetchMetricValues(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  reportIds: string[]
) {
  const allRows:
    Record<string, unknown>[] = [];

  for (
    let batchStart = 0;
    batchStart < reportIds.length;
    batchStart += REPORT_BATCH_SIZE
  ) {
    const batch =
      reportIds.slice(
        batchStart,
        batchStart +
          REPORT_BATCH_SIZE
      );

    let from = 0;

    while (true) {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "daily_metric_values"
          )
          .select(
            "report_id,metric_id,value"
          )
          .in(
            "report_id",
            batch
          )
          .order(
            "report_id",
            {
              ascending: true,
            }
          )
          .order(
            "metric_id",
            {
              ascending: true,
            }
          )
          .range(
            from,
            from +
              PAGE_SIZE -
              1
          );

      if (error) {
        throw error;
      }

      const rows =
        (data ?? []) as
          Record<
            string,
            unknown
          >[];

      allRows.push(...rows);

      if (
        rows.length <
        PAGE_SIZE
      ) {
        break;
      }

      from += PAGE_SIZE;
    }
  }

  return allRows;
}

export async function loadPerformanceAnalysisSnapshot(
  startDate: string,
  endDate: string
): Promise<PerformanceAnalysisSnapshot> {
  validateAnalysisRange(
    startDate,
    endDate
  );

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
    throw new Error(
      "로그인 정보가 없습니다."
    );
  }

  /*
   * 관리자 계정은 분석 메뉴 사용 권한은 유지하지만,
   * 매니저 실적 분석 대상에서는 제외합니다.
   *
   * 기존 managers 테이블이나 권한은 변경하지 않고
   * 분석 조회 결과에서만 role=admin을 제외합니다.
   */
  const [
    currentManagerResult,
    managersResult,
    categoriesResult,
    metricsResult,
  ] =
    await Promise.all([
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
        .from("managers")
        .select(
          "id,employee_no,name,role,is_active,display_order"
        )
        .order(
          "display_order",
          {
            ascending: true,
          }
        )
        .order(
          "name",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "metric_categories"
        )
        .select("*"),

      supabase
        .from("metrics")
        .select("*"),
    ]);

  if (
    currentManagerResult.error ||
    !currentManagerResult.data ||
    !currentManagerResult.data
      .is_active
  ) {
    throw new Error(
      "분석 메뉴를 사용할 수 있는 매니저 계정이 아닙니다."
    );
  }

  const firstMasterError =
    managersResult.error ??
    categoriesResult.error ??
    metricsResult.error;

  if (firstMasterError) {
    throw firstMasterError;
  }

  const rawManagers =
    ((managersResult.data ?? []) as
      Record<
        string,
        unknown
      >[]).filter(
      (row) =>
        !isAdminRole(
          row.role
        )
    );

  const managerIds =
    rawManagers
      .map((row) =>
        String(
          row.id ?? ""
        )
      )
      .filter(Boolean);

  let rawReports:
    Record<string, unknown>[] = [];

  if (managerIds.length > 0) {
    const reportsResult =
      await supabase
        .from(
          "daily_reports"
        )
        .select(
          "id,report_date,manager_id,status"
        )
        .gte(
          "report_date",
          startDate
        )
        .lte(
          "report_date",
          endDate
        )
        .in(
          "manager_id",
          managerIds
        )
        .in(
          "status",
          [
            "submitted",
            "closed",
          ]
        )
        .order(
          "report_date",
          {
            ascending: true,
          }
        );

    if (reportsResult.error) {
      throw reportsResult.error;
    }

    rawReports =
      (reportsResult.data ?? []) as
        Record<
          string,
          unknown
        >[];
  }

  const reportIds =
    rawReports
      .map((row) =>
        String(
          row.id ?? ""
        )
      )
      .filter(Boolean);

  const rawMetricValues =
    reportIds.length === 0
      ? []
      : await fetchMetricValues(
          supabase,
          reportIds
        );

  const managers =
    normalizeManagers(
      rawManagers
    );

  const categories =
    normalizeCategories(
      (categoriesResult.data ??
        []) as Record<
          string,
          unknown
        >[]
    );

  const metrics =
    normalizeMetrics(
      (metricsResult.data ??
        []) as Record<
          string,
          unknown
        >[]
    );

  const reports =
    normalizeReports(
      rawReports
    );

  const metricValues =
    normalizeMetricValues(
      rawMetricValues
    );

  return buildPerformanceSnapshot({
    startDate,
    endDate,
    managers,
    categories,
    metrics,
    reports,
    metricValues,
  });
}
