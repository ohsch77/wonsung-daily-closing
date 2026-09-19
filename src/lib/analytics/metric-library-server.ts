import {
  createClient,
} from "@/lib/supabase/server";

import {
  normalizeFormulaDefinition,
  normalizeFormulaToken,
  normalizeLibraryItem,
  normalizeUsage,
  toBuilderTokens,
  validateBuilderTokens,
} from "@/lib/analytics/metric-library";

import {
  createFormulaEngine,
} from "@/lib/analytics/formula-engine";

import type {
  AnalysisMetricLibrarySnapshot,
  AnalysisMetricPreviewResult,
  PreviewAnalysisMetricPayload,
  SaveAnalysisMetricPayload,
} from "@/lib/analytics/metric-library";

import type {
  FormulaEngineReport,
} from "@/lib/analytics/formula-engine";


async function getSessionContext() {
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
    manager.is_active === false
  ) {
    throw new Error(
      "사용중인 매니저 계정만 분석을 사용할 수 있습니다."
    );
  }

  return {
    supabase,
    canManage:
      String(
        manager.role ?? ""
      )
        .trim()
        .toLowerCase() ===
      "admin",
  };
}


export async function loadAnalysisMetricLibrary(): Promise<AnalysisMetricLibrarySnapshot> {
  const {
    supabase,
    canManage,
  } =
    await getSessionContext();

  const [
    libraryResult,
    definitionsResult,
    tokenResult,
    usageResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "analysis_metric_library_v"
        )
        .select("*")
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
          "analysis_metric_definitions"
        )
        .select("*")
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
          "analysis_metric_formula_tokens_v"
        )
        .select("*")
        .order(
          "analysis_metric_id",
          {
            ascending: true,
          }
        )
        .order(
          "token_order",
          {
            ascending: true,
          }
        ),

      supabase
        .from(
          "analysis_metric_reference_usage_v"
        )
        .select("*")
        .order(
          "dependent_metric_name",
          {
            ascending: true,
          }
        ),
    ]);

  const firstError =
    libraryResult.error ??
    definitionsResult.error ??
    tokenResult.error ??
    usageResult.error;

  if (firstError) {
    throw firstError;
  }

  return {
    items:
      (libraryResult.data ?? [])
        .map(
          (row) =>
            normalizeLibraryItem(
              row as Record<
                string,
                unknown
              >
            )
        )
        .filter(
          (row) =>
            row.sourceId !== "" &&
            row.name !== ""
        ),

    formulaDefinitions:
      (definitionsResult.data ?? [])
        .map(
          (row) =>
            normalizeFormulaDefinition(
              row as Record<
                string,
                unknown
              >
            )
        )
        .filter(
          (row) =>
            row.id !== "" &&
            row.name !== ""
        ),

    formulaTokens:
      (tokenResult.data ?? [])
        .map(
          (row) =>
            normalizeFormulaToken(
              row as Record<
                string,
                unknown
              >
            )
        )
        .filter(
          (row) =>
            row.analysisMetricId !== ""
        ),

    usages:
      (usageResult.data ?? [])
        .map(
          (row) =>
            normalizeUsage(
              row as Record<
                string,
                unknown
              >
            )
        )
        .filter(
          (row) =>
            row.referencedSourceId !== "" &&
            row.dependentMetricId !== ""
        ),

    canManage,
    generatedAt:
      new Date().toISOString(),
  };
}


export async function saveAnalysisMetric(
  payload:
    SaveAnalysisMetricPayload
) {
  const {
    supabase,
    canManage,
  } =
    await getSessionContext();

  if (!canManage) {
    throw new Error(
      "분석항목 생성·수정은 관리자만 할 수 있습니다."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "admin_save_analysis_metric",
      {
        p_metric_id:
          payload.metricId,

        p_name:
          payload.name,

        p_group_name:
          payload.groupName,

        p_description:
          payload.description ||
          null,

        p_metric_kind:
          payload.metricKind,

        p_unit:
          payload.unit,

        p_default_aggregation_type:
          payload.defaultAggregationType,

        p_display_order:
          payload.displayOrder,

        p_tokens:
          payload.tokens.map(
            (token) => {
              switch (
                token.type
              ) {
                case "raw_metric":
                  return {
                    type:
                      "raw_metric",
                    metric_id:
                      token.metricId,
                  };

                case "analysis_metric":
                  return {
                    type:
                      "analysis_metric",
                    metric_id:
                      token.metricId,
                  };

                case "operator":
                  return {
                    type:
                      "operator",
                    value:
                      token.value,
                  };

                case "number":
                  return {
                    type:
                      "number",
                    value:
                      token.value,
                  };

                default:
                  return {
                    type:
                      token.type,
                  };
              }
            }
          ),
      }
    );

  if (error) {
    throw error;
  }

  return String(
    data ?? ""
  );
}


export async function setAnalysisMetricActive(
  metricId: string,
  isActive: boolean
) {
  const {
    supabase,
    canManage,
  } =
    await getSessionContext();

  if (!canManage) {
    throw new Error(
      "분석항목 사용여부 변경은 관리자만 할 수 있습니다."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "admin_set_analysis_metric_active",
      {
        p_metric_id:
          metricId,
        p_is_active:
          isActive,
      }
    );

  if (error) {
    throw error;
  }

  return data;
}


export async function deleteAnalysisMetric(
  metricId: string
) {
  const {
    supabase,
    canManage,
  } =
    await getSessionContext();

  if (!canManage) {
    throw new Error(
      "분석항목 삭제는 관리자만 할 수 있습니다."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "admin_delete_analysis_metric",
      {
        p_metric_id:
          metricId,
      }
    );

  if (error) {
    throw error;
  }

  return data;
}


const PREVIEW_REPORT_BATCH_SIZE =
  200;


function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
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
    )
      .formatToParts(
        new Date()
      );

  const map =
    new Map(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}


async function fetchPreviewMetricValues(
  supabase:
    Awaited<
      ReturnType<
        typeof createClient
      >
    >,
  reportIds:
    string[]
) {
  const all:
    Array<{
      report_id:
        unknown;
      metric_id:
        unknown;
      value:
        unknown;
    }> = [];

  for (
    let start = 0;
    start <
    reportIds.length;
    start +=
      PREVIEW_REPORT_BATCH_SIZE
  ) {
    const batch =
      reportIds.slice(
        start,
        start +
          PREVIEW_REPORT_BATCH_SIZE
      );

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
        );

    if (error) {
      throw error;
    }

    all.push(
      ...(
        data ??
        []
      )
    );
  }

  return all;
}


export async function previewAnalysisMetric(
  payload:
    PreviewAnalysisMetricPayload
): Promise<AnalysisMetricPreviewResult> {
  const validation =
    validateBuilderTokens(
      payload.tokens,
      {
        selfMetricId:
          payload.metricId,
      }
    );

  if (
    !validation.valid
  ) {
    throw new Error(
      validation.message
    );
  }

  if (
    payload.metricKind ===
      "ratio" &&
    payload.defaultAggregationType !==
      "rate"
  ) {
    throw new Error(
      "비율항목의 기본 집계방식은 성공률이어야 합니다."
    );
  }

  if (
    payload.metricKind ===
      "calculated" &&
    payload.defaultAggregationType ===
      "rate"
  ) {
    throw new Error(
      "성공률 집계는 비율항목에서만 사용할 수 있습니다."
    );
  }

  if (
    ![
      "amount",
      "count",
      "percent",
      "number",
    ].includes(
      payload.unit
    )
  ) {
    throw new Error(
      "표시단위를 확인해주세요."
    );
  }

  const {
    supabase,
  } =
    await getSessionContext();

  const today =
    getKstToday();
  const startDate =
    `${today.slice(0, 7)}-01`;
  const endDate =
    today;

  const [
    library,
    managerResult,
  ] =
    await Promise.all([
      loadAnalysisMetricLibrary(),

      supabase
        .from("managers")
        .select(
          "id,employee_no,name,role,is_active,display_order"
        )
        .order(
          "display_order",
          {
            ascending:
              true,
          }
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        ),
    ]);

  if (
    managerResult.error
  ) {
    throw managerResult.error;
  }

  const managers:
    Array<{
      id: string;
      employeeNo: string;
      name: string;
      displayOrder: number;
    }> =
    (
      managerResult.data ??
      []
    )
      .filter(
        (manager) =>
          String(
            manager.role ??
            ""
          )
            .trim()
            .toLowerCase() !==
          "admin"
      )
      .map(
        (
          manager,
          index
        ) => ({
          id:
            String(
              manager.id ??
              ""
            ),
          employeeNo:
            String(
              manager.employee_no ??
              ""
            ),
          name:
            String(
              manager.name ??
              ""
            ),
          displayOrder:
            Number.isFinite(
              Number(
                manager.display_order
              )
            )
              ? Number(
                  manager.display_order
                )
              : index +
                1,
        })
      )
      .filter(
        (manager) =>
          manager.id !==
          ""
      );

  const managerIds =
    managers.map(
      (manager) =>
        manager.id
    );

  let reports:
    Array<{
      id: unknown;
      report_date:
        unknown;
      manager_id:
        unknown;
    }> = [];

  if (
    managerIds.length >
    0
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "daily_reports"
        )
        .select(
          "id,report_date,manager_id"
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
            ascending:
              true,
          }
        );

    if (error) {
      throw error;
    }

    reports =
      data ??
      [];
  }

  const reportIds =
    reports
      .map(
        (report) =>
          String(
            report.id ??
            ""
          )
      )
      .filter(
        Boolean
      );

  const metricValues =
    reportIds.length ===
    0
      ? []
      : await fetchPreviewMetricValues(
          supabase,
          reportIds
        );

  const valuesByReport =
    new Map<
      string,
      Map<
        string,
        number
      >
    >();

  for (
    const row of
    metricValues
  ) {
    const reportId =
      String(
        row.report_id ??
        ""
      );
    const metricId =
      String(
        row.metric_id ??
        ""
      );

    if (
      reportId ===
        "" ||
      metricId ===
        ""
    ) {
      continue;
    }

    const value =
      Number(
        row.value ??
        0
      );

    const target =
      valuesByReport.get(
        reportId
      ) ??
      new Map<
        string,
        number
      >();

    target.set(
      metricId,
      Number.isFinite(
        value
      )
        ? value
        : 0
    );

    valuesByReport.set(
      reportId,
      target
    );
  }

  const engineReports:
    FormulaEngineReport[] =
      reports
        .map(
          (report) => {
            const reportId =
              String(
                report.id ??
                ""
              );

            return {
              reportId,
              reportDate:
                String(
                  report.report_date ??
                  ""
                ),
              managerId:
                String(
                  report.manager_id ??
                  ""
                ),
              values:
                valuesByReport.get(
                  reportId
                ) ??
                new Map(),
            };
          }
        )
        .filter(
          (report) =>
            report.reportId !==
              "" &&
            report.managerId !==
              ""
        );

  const definitions =
    library
      .formulaDefinitions
      .filter(
        (definition) =>
          definition.id !==
          payload.metricId
      )
      .map(
        (definition) => ({
          id:
            definition.id,
          aggregationType:
            definition.defaultAggregationType,
          tokens:
            toBuilderTokens(
              library.formulaTokens
                .filter(
                  (token) =>
                    token.analysisMetricId ===
                    definition.id
                )
            ),
        })
      );

  const previewMetricId =
    "__preview_metric__";

  definitions.push({
    id:
      previewMetricId,
    aggregationType:
      payload.defaultAggregationType,
    tokens:
      payload.tokens,
  });

  const engine =
    createFormulaEngine(
      definitions
    );

  const managerMap =
    new Map(
      managers.map(
        (manager) => [
          manager.id,
          manager,
        ]
      )
    );

  const groupedReports =
    new Map<
      string,
      FormulaEngineReport[]
    >();

  for (
    const report of
    engineReports
  ) {
    const current =
      groupedReports.get(
        report.managerId
      ) ??
      [];

    current.push(
      report
    );

    groupedReports.set(
      report.managerId,
      current
    );
  }

  const rows =
    Array.from(
      groupedReports.entries()
    )
      .map(
        ([
          managerId,
          managerReports,
        ]) => {
          const manager =
            managerMap.get(
              managerId
            );

          const result =
            engine
              .evaluatePeriod(
                previewMetricId,
                managerReports
              );

          return {
            managerId,
            managerName:
              manager?.name ??
              "",
            employeeNo:
              manager
                ?.employeeNo ??
              "",
            displayOrder:
              manager
                ?.displayOrder ??
              999999,
            reportCount:
              managerReports.length,
            value:
              result.value,
            divideByZeroCount:
              result.issue
                .divideByZeroCount,
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          a.displayOrder -
            b.displayOrder ||
          a.managerName.localeCompare(
            b.managerName,
            "ko"
          )
      )
      .map(
        (row) => ({
          managerId:
            row.managerId,
          managerName:
            row.managerName,
          employeeNo:
            row.employeeNo,
          reportCount:
            row.reportCount,
          value:
            row.value,
          divideByZeroCount:
            row.divideByZeroCount,
        })
      );

  const totalResult =
    engine.evaluatePeriod(
      previewMetricId,
      engineReports
    );

  return {
    startDate,
    endDate,
    completedReportCount:
      engineReports.length,
    managerCount:
      rows.length,
    totalValue:
      totalResult.value,
    totalDivideByZeroCount:
      totalResult.issue
        .divideByZeroCount,
    unit:
      payload.unit,
    aggregationType:
      payload.defaultAggregationType,
    rows,
    generatedAt:
      new Date()
        .toISOString(),
  };
}
