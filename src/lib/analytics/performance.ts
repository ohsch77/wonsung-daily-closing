import type {
  AnalyticsCategory,
  AnalyticsDailyReport,
  AnalyticsManager,
  AnalyticsMetric,
  AnalyticsMetricValue,
  PerformanceAnalysisRow,
  PerformanceAnalysisSnapshot,
  PerformanceMetricResolution,
  ReviewMetricDefinition,
} from "@/lib/analytics/types";

type RawManagerRow = Record<string, unknown>;
type RawCategoryRow = Record<string, unknown>;
type RawMetricRow = Record<string, unknown>;
type RawReportRow = Record<string, unknown>;
type RawMetricValueRow = Record<string, unknown>;

function text(value: unknown) {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}

function nullableText(value: unknown) {
  const result = text(value);
  return result === "" ? null : result;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeKey(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[\s_\-./()[\]{}]+/g, "");
}

function normalizeCode(value: unknown) {
  return text(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function safeDisplayOrder(
  value: unknown,
  fallback: number
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

export function normalizeManagers(
  rows: RawManagerRow[]
): AnalyticsManager[] {
  return rows
    .map((row, index) => ({
      id: text(row.id),
      employeeNo: text(row.employee_no),
      name: text(row.name),
      isActive: row.is_active !== false,
      displayOrder: safeDisplayOrder(
        row.display_order,
        (index + 1) * 10
      ),
    }))
    .filter((row) => row.id !== "")
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.name.localeCompare(b.name, "ko")
    );
}

export function normalizeCategories(
  rows: RawCategoryRow[]
): AnalyticsCategory[] {
  return rows
    .map((row, index) => ({
      id: text(row.id),
      code: text(row.code),
      name: text(row.name),
      isActive: row.is_active !== false,
      displayOrder: safeDisplayOrder(
        row.display_order,
        (index + 1) * 10
      ),
    }))
    .filter((row) => row.id !== "")
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.name.localeCompare(b.name, "ko")
    );
}

export function normalizeMetrics(
  rows: RawMetricRow[]
): AnalyticsMetric[] {
  return rows
    .map((row, index) => {
      const rawEffectSign = Number(
        row.effect_sign
      );

      const aggregationType =
        row.aggregation_type === "average"
          ? "average"
          : row.aggregation_type === "rate"
            ? "rate"
            : "sum";

      const unit =
        row.unit === "amount"
          ? "amount"
          : row.unit === "percent"
            ? "percent"
            : "count";

      return {
        id: text(row.id),
        categoryId: text(row.category_id),
        code: text(row.code),
        name: text(row.name),
        unit,
        effectSign:
          rawEffectSign < 0 ? -1 : 1,
        aggregationType,
        numeratorMetricId:
          nullableText(
            row.numerator_metric_id
          ),
        denominatorMetricId:
          nullableText(
            row.denominator_metric_id
          ),
        isActive: row.is_active !== false,
        displayOrder: safeDisplayOrder(
          row.display_order,
          (index + 1) * 10
        ),
      } satisfies AnalyticsMetric;
    })
    .filter((row) => row.id !== "")
    .sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        a.name.localeCompare(b.name, "ko")
    );
}

export function normalizeReports(
  rows: RawReportRow[]
): AnalyticsDailyReport[] {
  return rows
    .map((row) => ({
      id: text(row.id),
      reportDate: text(row.report_date),
      managerId: text(row.manager_id),
      status: text(row.status),
    }))
    .filter(
      (row) =>
        row.id !== "" &&
        row.reportDate !== "" &&
        row.managerId !== ""
    );
}

export function normalizeMetricValues(
  rows: RawMetricValueRow[]
): AnalyticsMetricValue[] {
  return rows
    .map((row) => ({
      reportId: text(row.report_id),
      metricId: text(row.metric_id),
      value: numberValue(row.value),
    }))
    .filter(
      (row) =>
        row.reportId !== "" &&
        row.metricId !== ""
    );
}

const codeAliases = {
  storeSales: [
    "STORE_SALE",
    "STORE_SALES",
    "SHOP_SALE",
    "SHOP_SALES",
    "IN_STORE_SALE",
    "INSTORE_SALE",
  ],
  externalSales: [
    "EXTERNAL_SALE",
    "EXTERNAL_SALES",
    "OUTSIDE_SALE",
    "OUTSIDE_SALES",
    "OUT_SALE",
  ],
  salesCancel: [
    "SALE_CANCEL",
    "SALES_CANCEL",
    "SALE_CANCELLATION",
    "SALES_CANCELLATION",
  ],
  subscriptionSales: [
    "SUBSCRIPTION_SALE",
    "SUBSCRIPTION_SALES",
    "SUB_SALE",
    "SUB_SALES",
  ],
  subscriptionCancel: [
    "SUBSCRIPTION_CANCEL",
    "SUBSCRIPTION_CANCELLATION",
    "SUB_CANCEL",
  ],
  kyowonSales: [
    "KYOWON_SALE",
    "KYOWON_SALES",
  ],
  kyowonCancel: [
    "KYOWON_CANCEL",
    "KYOWON_CANCELLATION",
  ],
  consultationCount: [
    "CONSULTATION_COUNT",
    "CONSULT_COUNT",
    "COUNSEL_COUNT",
    "COUNSELING_COUNT",
  ],
  consultationSales: [
    "CONSULTATION_SALE_COUNT",
    "CONSULTATION_SALES_COUNT",
    "CONSULT_SALE_COUNT",
    "SALES_COUNT",
  ],
  leadIn: [
    "LEAD_IN",
    "LEAD_INPUT",
    "LEAD_RECEIVED",
  ],
  leadSuccess: [
    "LEAD_SUCCESS",
    "LEAD_SALE",
    "LEAD_CONVERTED",
  ],
} as const;

const nameAliases = {
  storeSales: [
    "매장판매",
    "매장판매금액",
  ],
  externalSales: [
    "외부판매",
    "외부판매금액",
  ],
  salesCancel: [
    "판매취소",
    "판매취소금액",
  ],
  subscriptionSales: [
    "구독판매",
    "구독판매건수",
  ],
  subscriptionCancel: [
    "구독취소",
    "구독취소건수",
  ],
  kyowonSales: [
    "교원판매",
    "교원판매건수",
  ],
  kyowonCancel: [
    "교원취소",
    "교원취소건수",
  ],
  consultationCount: [
    "상담건수",
    "상담수",
    "상담",
  ],
  consultationSales: [
    "판매건수",
    "상담판매건수",
    "판매성공건수",
  ],
  leadIn: [
    "입수건수",
    "가망객입수건수",
    "입수",
  ],
  leadSuccess: [
    "성공건수",
    "가망객성공건수",
    "성공",
  ],
} as const;

function categoryText(
  metric: AnalyticsMetric,
  categoryById: Map<string, AnalyticsCategory>
) {
  const category =
    categoryById.get(metric.categoryId);

  return normalizeKey(
    `${category?.code ?? ""} ${category?.name ?? ""}`
  );
}

function findMetric(
  metrics: AnalyticsMetric[],
  categoryById: Map<string, AnalyticsCategory>,
  codes: readonly string[],
  names: readonly string[],
  categoryHints: readonly string[] = []
) {
  const normalizedCodes =
    new Set(
      codes.map((code) =>
        normalizeCode(code)
      )
    );

  const normalizedNames =
    new Set(
      names.map((name) =>
        normalizeKey(name)
      )
    );

  const normalizedCategoryHints =
    categoryHints.map((hint) =>
      normalizeKey(hint)
    );

  const candidates =
    metrics
      .map((metric) => {
        const metricCode =
          normalizeCode(metric.code);
        const metricName =
          normalizeKey(metric.name);
        const category =
          categoryText(
            metric,
            categoryById
          );

        const codeMatch =
          normalizedCodes.has(metricCode);
        const nameMatch =
          normalizedNames.has(metricName);
        const categoryMatch =
          normalizedCategoryHints.length === 0 ||
          normalizedCategoryHints.some(
            (hint) =>
              category.includes(hint)
          );

        let score = 0;

        if (codeMatch) score += 100;
        if (nameMatch) score += 60;
        if (categoryMatch) score += 10;
        if (metric.isActive) score += 5;
        if (
          metric.aggregationType !==
          "rate"
        ) {
          score += 2;
        }

        return {
          metric,
          score:
            codeMatch || nameMatch
              ? score
              : 0,
        };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.metric.displayOrder -
            b.metric.displayOrder
      );

  return candidates[0]?.metric ?? null;
}

function resolveConsultationPair(
  metrics: AnalyticsMetric[],
  categoryById: Map<string, AnalyticsCategory>
) {
  const directCount =
    findMetric(
      metrics,
      categoryById,
      codeAliases.consultationCount,
      nameAliases.consultationCount,
      ["상담", "consult"]
    );

  const directSales =
    findMetric(
      metrics,
      categoryById,
      codeAliases.consultationSales,
      nameAliases.consultationSales,
      ["상담", "consult"]
    );

  if (
    directCount &&
    directSales
  ) {
    return {
      consultationCountMetricId:
        directCount.id,
      consultationSalesMetricId:
        directSales.id,
    };
  }

  const rateMetric =
    metrics
      .filter(
        (metric) =>
          metric.aggregationType ===
            "rate" &&
          metric.numeratorMetricId &&
          metric.denominatorMetricId
      )
      .find((metric) => {
        const key =
          normalizeKey(
            `${metric.code} ${metric.name} ${categoryText(
              metric,
              categoryById
            )}`
          );

        return (
          key.includes("상담") ||
          key.includes("consult") ||
          key.includes("counsel")
        );
      });

  return {
    consultationCountMetricId:
      directCount?.id ??
      rateMetric?.denominatorMetricId ??
      null,
    consultationSalesMetricId:
      directSales?.id ??
      rateMetric?.numeratorMetricId ??
      null,
  };
}

function resolveReviewMetrics(
  metrics: AnalyticsMetric[],
  categoryById: Map<string, AnalyticsCategory>
): ReviewMetricDefinition[] {
  const fixedReviewNames =
    new Set(
      [
        "웨딩카페",
        "블로그",
        "네이버리뷰",
        "입주카페",
        "단톡방",
      ].map(normalizeKey)
    );

  return metrics
    .filter((metric) => {
      if (
        metric.aggregationType ===
        "rate"
      ) {
        return false;
      }

      const category =
        categoryText(
          metric,
          categoryById
        );
      const name =
        normalizeKey(metric.name);

      return (
        category.includes("후기") ||
        category.includes("review") ||
        fixedReviewNames.has(name)
      );
    })
    .sort(
      (a, b) =>
        a.displayOrder -
          b.displayOrder ||
        a.name.localeCompare(
          b.name,
          "ko"
        )
    )
    .map((metric) => ({
      metricId: metric.id,
      code: metric.code,
      name: metric.name,
    }));
}

export function resolvePerformanceMetrics(
  categories: AnalyticsCategory[],
  metrics: AnalyticsMetric[]
): PerformanceMetricResolution {
  const categoryById =
    new Map(
      categories.map(
        (category) => [
          category.id,
          category,
        ]
      )
    );

  const storeSales =
    findMetric(
      metrics,
      categoryById,
      codeAliases.storeSales,
      nameAliases.storeSales,
      ["총판", "판매"]
    );

  const externalSales =
    findMetric(
      metrics,
      categoryById,
      codeAliases.externalSales,
      nameAliases.externalSales,
      ["총판", "판매"]
    );

  const salesCancel =
    findMetric(
      metrics,
      categoryById,
      codeAliases.salesCancel,
      nameAliases.salesCancel,
      ["총판", "판매"]
    );

  const subscriptionSales =
    findMetric(
      metrics,
      categoryById,
      codeAliases.subscriptionSales,
      nameAliases.subscriptionSales,
      ["구독"]
    );

  const subscriptionCancel =
    findMetric(
      metrics,
      categoryById,
      codeAliases.subscriptionCancel,
      nameAliases.subscriptionCancel,
      ["구독"]
    );

  const kyowonSales =
    findMetric(
      metrics,
      categoryById,
      codeAliases.kyowonSales,
      nameAliases.kyowonSales,
      ["교원"]
    );

  const kyowonCancel =
    findMetric(
      metrics,
      categoryById,
      codeAliases.kyowonCancel,
      nameAliases.kyowonCancel,
      ["교원"]
    );

  const leadIn =
    findMetric(
      metrics,
      categoryById,
      codeAliases.leadIn,
      nameAliases.leadIn,
      ["가망", "lead"]
    );

  const leadSuccess =
    findMetric(
      metrics,
      categoryById,
      codeAliases.leadSuccess,
      nameAliases.leadSuccess,
      ["가망", "lead"]
    );

  const consultationPair =
    resolveConsultationPair(
      metrics,
      categoryById
    );

  const reviewMetrics =
    resolveReviewMetrics(
      metrics,
      categoryById
    );

  const missingLabels: string[] =
    [];

  const required: Array<
    [string, string | null]
  > = [
    ["매장판매", storeSales?.id ?? null],
    ["외부판매", externalSales?.id ?? null],
    ["판매취소", salesCancel?.id ?? null],
    [
      "구독판매",
      subscriptionSales?.id ?? null,
    ],
    [
      "구독취소",
      subscriptionCancel?.id ?? null,
    ],
    [
      "교원판매",
      kyowonSales?.id ?? null,
    ],
    [
      "교원취소",
      kyowonCancel?.id ?? null,
    ],
    [
      "상담건수",
      consultationPair
        .consultationCountMetricId,
    ],
    [
      "판매건수",
      consultationPair
        .consultationSalesMetricId,
    ],
    ["입수건수", leadIn?.id ?? null],
    ["성공건수", leadSuccess?.id ?? null],
  ];

  for (const [label, id] of required) {
    if (!id) {
      missingLabels.push(label);
    }
  }

  if (reviewMetrics.length === 0) {
    missingLabels.push("후기관리 항목");
  }

  return {
    storeSalesMetricId:
      storeSales?.id ?? null,
    externalSalesMetricId:
      externalSales?.id ?? null,
    salesCancelMetricId:
      salesCancel?.id ?? null,
    subscriptionSalesMetricId:
      subscriptionSales?.id ?? null,
    subscriptionCancelMetricId:
      subscriptionCancel?.id ?? null,
    kyowonSalesMetricId:
      kyowonSales?.id ?? null,
    kyowonCancelMetricId:
      kyowonCancel?.id ?? null,
    consultationCountMetricId:
      consultationPair
        .consultationCountMetricId,
    consultationSalesMetricId:
      consultationPair
        .consultationSalesMetricId,
    leadInMetricId:
      leadIn?.id ?? null,
    leadSuccessMetricId:
      leadSuccess?.id ?? null,
    reviewMetrics,
    missingLabels,
  };
}

function rate(
  numerator: number,
  denominator: number
) {
  if (denominator <= 0) {
    return null;
  }

  return (
    Math.round(
      (numerator / denominator) *
        1000
    ) / 10
  );
}

function monthKey(
  reportDate: string
) {
  return reportDate.slice(0, 7);
}

function metricValue(
  valueMap: Map<string, number>,
  metricId: string | null
) {
  return metricId
    ? valueMap.get(metricId) ?? 0
    : 0;
}

function createBaseRow(
  periodKey: string,
  reportDate: string | null,
  month: string,
  manager: AnalyticsManager,
  resolution: PerformanceMetricResolution
): PerformanceAnalysisRow {
  const reviewValues:
    Record<string, number> = {};

  for (
    const reviewMetric of
    resolution.reviewMetrics
  ) {
    reviewValues[
      reviewMetric.metricId
    ] = 0;
  }

  return {
    periodKey,
    reportDate,
    monthKey: month,
    managerId: manager.id,
    managerName: manager.name,
    employeeNo: manager.employeeNo,

    totalSalesAmount: 0,

    subscriptionSalesCount: 0,
    subscriptionCancelCount: 0,
    subscriptionNetCount: 0,

    kyowonSalesCount: 0,
    kyowonCancelCount: 0,
    kyowonNetCount: 0,

    consultationCount: 0,
    consultationSalesCount: 0,
    consultationSuccessRate: null,

    leadInCount: 0,
    leadSuccessCount: 0,
    leadSuccessRate: null,

    reviewValues,
    reviewTotal: 0,
  };
}

function finalizeRates(
  row: PerformanceAnalysisRow
) {
  row.subscriptionNetCount =
    row.subscriptionSalesCount -
    row.subscriptionCancelCount;

  row.kyowonNetCount =
    row.kyowonSalesCount -
    row.kyowonCancelCount;

  row.consultationSuccessRate =
    rate(
      row.consultationSalesCount,
      row.consultationCount
    );

  row.leadSuccessRate =
    rate(
      row.leadSuccessCount,
      row.leadInCount
    );

  row.reviewTotal =
    Object.values(
      row.reviewValues
    ).reduce(
      (sum, value) =>
        sum + value,
      0
    );

  return row;
}

export function buildDailyPerformanceRows(
  managers: AnalyticsManager[],
  reports: AnalyticsDailyReport[],
  metricValues: AnalyticsMetricValue[],
  resolution: PerformanceMetricResolution
): PerformanceAnalysisRow[] {
  const managerById =
    new Map(
      managers.map(
        (manager) => [
          manager.id,
          manager,
        ]
      )
    );

  const valueMapByReport =
    new Map<
      string,
      Map<string, number>
    >();

  for (
    const item of metricValues
  ) {
    let valueMap =
      valueMapByReport.get(
        item.reportId
      );

    if (!valueMap) {
      valueMap =
        new Map<string, number>();
      valueMapByReport.set(
        item.reportId,
        valueMap
      );
    }

    valueMap.set(
      item.metricId,
      (valueMap.get(item.metricId) ??
        0) + item.value
    );
  }

  const rows:
    PerformanceAnalysisRow[] = [];

  for (const report of reports) {
    if (
      report.status !==
        "submitted" &&
      report.status !== "closed"
    ) {
      continue;
    }

    const manager =
      managerById.get(
        report.managerId
      );

    if (!manager) {
      continue;
    }

    const values =
      valueMapByReport.get(
        report.id
      ) ??
      new Map<string, number>();

    const row =
      createBaseRow(
        `${report.reportDate}|${manager.id}`,
        report.reportDate,
        monthKey(report.reportDate),
        manager,
        resolution
      );

    const storeSales =
      metricValue(
        values,
        resolution
          .storeSalesMetricId
      );

    const externalSales =
      metricValue(
        values,
        resolution
          .externalSalesMetricId
      );

    const salesCancel =
      metricValue(
        values,
        resolution
          .salesCancelMetricId
      );

    row.totalSalesAmount =
      storeSales +
      externalSales -
      salesCancel;

    row.subscriptionSalesCount =
      metricValue(
        values,
        resolution
          .subscriptionSalesMetricId
      );

    row.subscriptionCancelCount =
      metricValue(
        values,
        resolution
          .subscriptionCancelMetricId
      );

    row.kyowonSalesCount =
      metricValue(
        values,
        resolution
          .kyowonSalesMetricId
      );

    row.kyowonCancelCount =
      metricValue(
        values,
        resolution
          .kyowonCancelMetricId
      );

    row.consultationCount =
      metricValue(
        values,
        resolution
          .consultationCountMetricId
      );

    row.consultationSalesCount =
      metricValue(
        values,
        resolution
          .consultationSalesMetricId
      );

    row.leadInCount =
      metricValue(
        values,
        resolution.leadInMetricId
      );

    row.leadSuccessCount =
      metricValue(
        values,
        resolution
          .leadSuccessMetricId
      );

    for (
      const reviewMetric of
      resolution.reviewMetrics
    ) {
      row.reviewValues[
        reviewMetric.metricId
      ] =
        metricValue(
          values,
          reviewMetric.metricId
        );
    }

    rows.push(
      finalizeRates(row)
    );
  }

  return rows.sort(
    (a, b) =>
      a.reportDate!.localeCompare(
        b.reportDate!
      ) ||
      a.managerName.localeCompare(
        b.managerName,
        "ko"
      )
  );
}

export function buildMonthlyPerformanceRows(
  dailyRows: PerformanceAnalysisRow[],
  managers: AnalyticsManager[],
  resolution: PerformanceMetricResolution
): PerformanceAnalysisRow[] {
  const managerById =
    new Map(
      managers.map(
        (manager) => [
          manager.id,
          manager,
        ]
      )
    );

  const grouped =
    new Map<
      string,
      PerformanceAnalysisRow
    >();

  for (const daily of dailyRows) {
    const key =
      `${daily.monthKey}|${daily.managerId}`;

    let row =
      grouped.get(key);

    if (!row) {
      const manager =
        managerById.get(
          daily.managerId
        );

      if (!manager) {
        continue;
      }

      row =
        createBaseRow(
          key,
          null,
          daily.monthKey,
          manager,
          resolution
        );

      grouped.set(
        key,
        row
      );
    }

    row.totalSalesAmount +=
      daily.totalSalesAmount;

    row.subscriptionSalesCount +=
      daily.subscriptionSalesCount;

    row.subscriptionCancelCount +=
      daily.subscriptionCancelCount;

    row.kyowonSalesCount +=
      daily.kyowonSalesCount;

    row.kyowonCancelCount +=
      daily.kyowonCancelCount;

    row.consultationCount +=
      daily.consultationCount;

    row.consultationSalesCount +=
      daily.consultationSalesCount;

    row.leadInCount +=
      daily.leadInCount;

    row.leadSuccessCount +=
      daily.leadSuccessCount;

    for (
      const [
        metricId,
        value,
      ] of Object.entries(
        daily.reviewValues
      )
    ) {
      row.reviewValues[
        metricId
      ] =
        (row.reviewValues[
          metricId
        ] ?? 0) + value;
    }
  }

  return Array.from(
    grouped.values()
  )
    .map(finalizeRates)
    .sort(
      (a, b) =>
        a.monthKey.localeCompare(
          b.monthKey
        ) ||
        a.managerName.localeCompare(
          b.managerName,
          "ko"
        )
    );
}

function buildRawMetricValuesByPeriodKey({
  managers,
  reports,
  metricValues,
}: {
  managers:
    AnalyticsManager[];
  reports:
    AnalyticsDailyReport[];
  metricValues:
    AnalyticsMetricValue[];
}) {
  const managerIds =
    new Set(
      managers.map(
        (manager) =>
          manager.id
      )
    );

  const periodKeyByReportId =
    new Map<
      string,
      string
    >();

  for (
    const report of
    reports
  ) {
    if (
      report.status !==
        "submitted" &&
      report.status !==
        "closed"
    ) {
      continue;
    }

    if (
      !managerIds.has(
        report.managerId
      )
    ) {
      continue;
    }

    periodKeyByReportId.set(
      report.id,
      `${report.reportDate}|${report.managerId}`
    );
  }

  const result:
    Record<
      string,
      Record<string, number>
    > = {};

  for (
    const item of
    metricValues
  ) {
    const periodKey =
      periodKeyByReportId.get(
        item.reportId
      );

    if (!periodKey) {
      continue;
    }

    const metricMap =
      result[
        periodKey
      ] ?? {};

    metricMap[
      item.metricId
    ] =
      (metricMap[
        item.metricId
      ] ?? 0) +
      item.value;

    result[
      periodKey
    ] =
      metricMap;
  }

  return result;
}


export function buildPerformanceSnapshot({
  startDate,
  endDate,
  managers,
  categories,
  metrics,
  reports,
  metricValues,
}: {
  startDate: string;
  endDate: string;
  managers: AnalyticsManager[];
  categories: AnalyticsCategory[];
  metrics: AnalyticsMetric[];
  reports: AnalyticsDailyReport[];
  metricValues: AnalyticsMetricValue[];
}): PerformanceAnalysisSnapshot {
  const resolution =
    resolvePerformanceMetrics(
      categories,
      metrics
    );

  const dailyRows =
    buildDailyPerformanceRows(
      managers,
      reports,
      metricValues,
      resolution
    );

  const monthlyRows =
    buildMonthlyPerformanceRows(
      dailyRows,
      managers,
      resolution
    );

  const rawMetricValuesByPeriodKey =
    buildRawMetricValuesByPeriodKey({
      managers,
      reports,
      metricValues,
    });

  return {
    startDate,
    endDate,
    managers,
    categories,
    metrics,
    resolution,
    dailyRows,
    monthlyRows,
    rawMetricValuesByPeriodKey,
    completedReportCount:
      reports.filter(
        (report) =>
          report.status ===
            "submitted" ||
          report.status ===
            "closed"
      ).length,
    metricValueCount:
      metricValues.length,
    generatedAt:
      new Date().toISOString(),
  };
}
