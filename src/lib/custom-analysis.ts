import type {
  AnalyticsManager,
  PerformanceAnalysisRow,
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";


export type CustomGranularity =
  | "monthly"
  | "daily";


export type CustomMetricKind =
  | "amount"
  | "count"
  | "rate";


export type CustomAggregation =
  | "sum"
  | "average"
  | "rate";


export type CustomMetricDefinition = {
  key: string;
  label: string;
  group: string;
  kind:
    CustomMetricKind;
};


export type CustomMetricSelection = {
  key: string;
  aggregation:
    CustomAggregation;
};


export type CustomAnalysisResultRow = {
  periodKey: string;
  reportDate:
    string | null;
  monthKey: string;

  managerId: string;
  managerName: string;
  employeeNo: string;
  managerDisplayOrder: number;

  sourceRowCount: number;

  values:
    Record<
      string,
      number | null
    >;
};


export type CustomAnalysisTotal = {
  sourceRowCount: number;

  values:
    Record<
      string,
      number | null
    >;
};


export type CustomAnalysisResult = {
  rows:
    CustomAnalysisResultRow[];

  total:
    CustomAnalysisTotal;
};


function roundOne(
  value: number
) {
  return (
    Math.round(
      value * 10
    ) / 10
  );
}


function calculateRate(
  numerator: number,
  denominator: number
) {
  if (
    denominator <= 0
  ) {
    return null;
  }

  return roundOne(
    (
      numerator /
      denominator
    ) * 100
  );
}


export function getAggregationLabel(
  aggregation:
    CustomAggregation
) {
  switch (
    aggregation
  ) {
    case "average":
      return "평균";

    case "rate":
      return "성공률";

    default:
      return "합계";
  }
}


export function getDefaultAggregation(
  metric:
    CustomMetricDefinition
): CustomAggregation {
  return metric.kind ===
    "rate"
    ? "rate"
    : "sum";
}


export function getAllowedAggregations(
  metric:
    CustomMetricDefinition
): CustomAggregation[] {
  if (
    metric.kind ===
    "rate"
  ) {
    return [
      "rate",
    ];
  }

  return [
    "sum",
    "average",
  ];
}


export function buildCustomMetricDefinitions(
  snapshot:
    PerformanceAnalysisSnapshot
): CustomMetricDefinition[] {
  const metrics:
    CustomMetricDefinition[] = [
      {
        key:
          "totalSalesAmount",
        label:
          "총판매금액",
        group:
          "판매",
        kind:
          "amount",
      },

      {
        key:
          "subscriptionSalesCount",
        label:
          "구독판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "subscriptionCancelCount",
        label:
          "구독취소",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "subscriptionNetCount",
        label:
          "구독순판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "kyowonSalesCount",
        label:
          "교원판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "kyowonCancelCount",
        label:
          "교원취소",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "kyowonNetCount",
        label:
          "교원순판매",
        group:
          "구독·교원",
        kind:
          "count",
      },

      {
        key:
          "consultationCount",
        label:
          "상담건수",
        group:
          "상담",
        kind:
          "count",
      },

      {
        key:
          "consultationSalesCount",
        label:
          "판매건수",
        group:
          "상담",
        kind:
          "count",
      },

      {
        key:
          "consultationSuccessRate",
        label:
          "상담성공률",
        group:
          "상담",
        kind:
          "rate",
      },

      {
        key:
          "leadInCount",
        label:
          "가망객입수",
        group:
          "가망객",
        kind:
          "count",
      },

      {
        key:
          "leadSuccessCount",
        label:
          "가망객성공",
        group:
          "가망객",
        kind:
          "count",
      },

      {
        key:
          "leadSuccessRate",
        label:
          "가망객성공률",
        group:
          "가망객",
        kind:
          "rate",
      },
    ];

  for (
    const reviewMetric of
    snapshot.resolution
      .reviewMetrics
  ) {
    metrics.push({
      key:
        `review:${reviewMetric.metricId}`,
      label:
        reviewMetric.name,
      group:
        "후기",
      kind:
        "count",
    });
  }

  metrics.push({
    key:
      "reviewTotal",
    label:
      "후기합계",
    group:
      "후기",
    kind:
      "count",
  });

  return metrics;
}


export function buildDefaultCustomMetricSelections(
  snapshot:
    PerformanceAnalysisSnapshot
): CustomMetricSelection[] {
  return buildCustomMetricDefinitions(
    snapshot
  ).map(
    (metric) => ({
      key:
        metric.key,

      aggregation:
        getDefaultAggregation(
          metric
        ),
    })
  );
}


export function getCustomMetricValue(
  row:
    PerformanceAnalysisRow,
  metricKey: string
): number | null {
  switch (
    metricKey
  ) {
    case "totalSalesAmount":
      return row.totalSalesAmount;

    case "subscriptionSalesCount":
      return row.subscriptionSalesCount;

    case "subscriptionCancelCount":
      return row.subscriptionCancelCount;

    case "subscriptionNetCount":
      return row.subscriptionNetCount;

    case "kyowonSalesCount":
      return row.kyowonSalesCount;

    case "kyowonCancelCount":
      return row.kyowonCancelCount;

    case "kyowonNetCount":
      return row.kyowonNetCount;

    case "consultationCount":
      return row.consultationCount;

    case "consultationSalesCount":
      return row.consultationSalesCount;

    case "consultationSuccessRate":
      return row.consultationSuccessRate;

    case "leadInCount":
      return row.leadInCount;

    case "leadSuccessCount":
      return row.leadSuccessCount;

    case "leadSuccessRate":
      return row.leadSuccessRate;

    case "reviewTotal":
      return row.reviewTotal;

    default:
      break;
  }

  if (
    metricKey.startsWith(
      "review:"
    )
  ) {
    const metricId =
      metricKey.slice(
        "review:".length
      );

    return (
      row.reviewValues[
        metricId
      ] ?? 0
    );
  }

  return null;
}


function calculateRateMetric(
  rows:
    PerformanceAnalysisRow[],
  metricKey: string
) {
  if (
    metricKey ===
    "consultationSuccessRate"
  ) {
    const numerator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.consultationSalesCount,
        0
      );

    const denominator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.consultationCount,
        0
      );

    return calculateRate(
      numerator,
      denominator
    );
  }

  if (
    metricKey ===
    "leadSuccessRate"
  ) {
    const numerator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.leadSuccessCount,
        0
      );

    const denominator =
      rows.reduce(
        (
          sum,
          row
        ) =>
          sum +
          row.leadInCount,
        0
      );

    return calculateRate(
      numerator,
      denominator
    );
  }

  return null;
}


function aggregateMetric(
  rows:
    PerformanceAnalysisRow[],
  metric:
    CustomMetricDefinition,
  selection:
    CustomMetricSelection
) {
  if (
    metric.kind ===
      "rate" ||
    selection.aggregation ===
      "rate"
  ) {
    return calculateRateMetric(
      rows,
      metric.key
    );
  }

  const values =
    rows
      .map(
        (row) =>
          getCustomMetricValue(
            row,
            metric.key
          )
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null &&
          Number.isFinite(
            value
          )
      );

  if (
    values.length ===
    0
  ) {
    return null;
  }

  const sum =
    values.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    );

  if (
    selection.aggregation ===
    "average"
  ) {
    const average =
      sum /
      values.length;

    return metric.kind ===
      "amount"
      ? Math.round(
          average
        )
      : roundOne(
          average
        );
  }

  return sum;
}


function buildSelectionMetricMap(
  snapshot:
    PerformanceAnalysisSnapshot
) {
  return new Map(
    buildCustomMetricDefinitions(
      snapshot
    ).map(
      (metric) => [
        metric.key,
        metric,
      ]
    )
  );
}


function managerOrderValue(
  manager:
    AnalyticsManager
) {
  return Number.isFinite(
    manager.displayOrder
  )
    ? manager.displayOrder
    : 9999;
}


export function buildCustomAnalysisResult({
  snapshot,
  selectedManagerIds,
  granularity,
  selections,
}: {
  snapshot:
    PerformanceAnalysisSnapshot;
  selectedManagerIds:
    string[];
  granularity:
    CustomGranularity;
  selections:
    CustomMetricSelection[];
}): CustomAnalysisResult {
  const selectedManagerSet =
    new Set(
      selectedManagerIds
    );

  const managerMap =
    new Map(
      snapshot.managers.map(
        (manager) => [
          manager.id,
          manager,
        ]
      )
    );

  const metricMap =
    buildSelectionMetricMap(
      snapshot
    );

  const validSelections =
    selections.filter(
      (selection) =>
        metricMap.has(
          selection.key
        )
    );

  const sourceRows =
    snapshot.dailyRows.filter(
      (row) =>
        selectedManagerSet.has(
          row.managerId
        )
    );

  const grouped =
    new Map<
      string,
      PerformanceAnalysisRow[]
    >();

  for (
    const row of
    sourceRows
  ) {
    const periodKey =
      granularity ===
      "monthly"
        ? row.monthKey
        : row.reportDate ??
          "";

    if (
      !periodKey
    ) {
      continue;
    }

    const key =
      `${periodKey}|${row.managerId}`;

    const rows =
      grouped.get(
        key
      ) ?? [];

    rows.push(
      row
    );

    grouped.set(
      key,
      rows
    );
  }

  const resultRows:
    CustomAnalysisResultRow[] =
    [];

  for (
    const [
      key,
      rows,
    ] of grouped.entries()
  ) {
    if (
      rows.length ===
      0
    ) {
      continue;
    }

    const [
      periodKey,
      managerId,
    ] =
      key.split("|");

    const manager =
      managerMap.get(
        managerId
      );

    if (
      !manager
    ) {
      continue;
    }

    const values:
      Record<
        string,
        number | null
      > = {};

    for (
      const selection of
      validSelections
    ) {
      const metric =
        metricMap.get(
          selection.key
        );

      if (
        !metric
      ) {
        continue;
      }

      values[
        selection.key
      ] =
        aggregateMetric(
          rows,
          metric,
          selection
        );
    }

    resultRows.push({
      periodKey,

      reportDate:
        granularity ===
        "daily"
          ? periodKey
          : null,

      monthKey:
        granularity ===
        "monthly"
          ? periodKey
          : periodKey.slice(
              0,
              7
            ),

      managerId:
        manager.id,

      managerName:
        manager.name,

      employeeNo:
        manager.employeeNo,

      managerDisplayOrder:
        managerOrderValue(
          manager
        ),

      sourceRowCount:
        rows.length,

      values,
    });
  }

  resultRows.sort(
    (a, b) =>
      a.periodKey.localeCompare(
        b.periodKey
      ) ||
      a.managerDisplayOrder -
        b.managerDisplayOrder ||
      a.managerName.localeCompare(
        b.managerName,
        "ko"
      )
  );

  const totalValues:
    Record<
      string,
      number | null
    > = {};

  for (
    const selection of
    validSelections
  ) {
    const metric =
      metricMap.get(
        selection.key
      );

    if (
      !metric
    ) {
      continue;
    }

    totalValues[
      selection.key
    ] =
      aggregateMetric(
        sourceRows,
        metric,
        selection
      );
  }

  return {
    rows:
      resultRows,

    total: {
      sourceRowCount:
        sourceRows.length,

      values:
        totalValues,
    },
  };
}
