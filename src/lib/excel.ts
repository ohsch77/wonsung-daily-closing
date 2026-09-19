import type {
  PerformanceAnalysisRow,
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";


export type AnalyticsMetricGroup =
  | "all"
  | "sales"
  | "subscription"
  | "consultation"
  | "lead"
  | "review";


type PerformanceExcelSummary = {
  totalSalesAmount: number;
  subscriptionNetCount: number;
  kyowonNetCount: number;
  consultationCount: number;
  consultationSalesCount: number;
  consultationSuccessRate:
    number | null;
  leadInCount: number;
  leadSuccessCount: number;
  leadSuccessRate:
    number | null;
  reviewValues:
    Record<string, number>;
  reviewTotal: number;
};


type ExportArgs = {
  view:
    | "monthly"
    | "daily";
  snapshot:
    PerformanceAnalysisSnapshot;
  rows:
    PerformanceAnalysisRow[];
  summary:
    PerformanceExcelSummary;
  metricGroup:
    AnalyticsMetricGroup;
  selectedManagerNames:
    string[];
};


type ColumnDefinition = {
  key: string;
  header: string;
  width: number;
  kind:
    | "text"
    | "amount"
    | "count"
    | "rate";
  getRowValue:
    (
      row:
        PerformanceAnalysisRow
    ) =>
      string |
      number |
      null;
  getTotalValue:
    (
      summary:
        PerformanceExcelSummary,
      managerCount:
        number
    ) =>
      string |
      number |
      null;
};


function groupLabel(
  group:
    AnalyticsMetricGroup
) {
  switch (group) {
    case "sales":
      return "판매";
    case "subscription":
      return "구독·교원";
    case "consultation":
      return "상담";
    case "lead":
      return "가망객";
    case "review":
      return "후기";
    default:
      return "전체";
  }
}


function safeFilePart(
  value: string
) {
  return value
    .replace(
      /[\\/:*?"<>|]/g,
      "-"
    )
    .replace(
      /\s+/g,
      "_"
    );
}


function toRateValue(
  value:
    number | null
) {
  return value === null
    ? null
    : value / 100;
}


function buildColumns(
  view:
    | "monthly"
    | "daily",
  snapshot:
    PerformanceAnalysisSnapshot,
  metricGroup:
    AnalyticsMetricGroup
) {
  const columns:
    ColumnDefinition[] = [
      {
        key:
          view ===
          "monthly"
            ? "month"
            : "date",
        header:
          view ===
          "monthly"
            ? "월"
            : "일자",
        width: 13,
        kind: "text",
        getRowValue:
          (row) =>
            view ===
            "monthly"
              ? row.monthKey
              : row.reportDate ??
                "",
        getTotalValue:
          () =>
            "합계",
      },
      {
        key: "manager",
        header: "매니저",
        width: 14,
        kind: "text",
        getRowValue:
          (row) =>
            row.managerName,
        getTotalValue:
          (
            _summary,
            managerCount
          ) =>
            `${managerCount}명 선택`,
      },
      {
        key:
          "employeeNo",
        header: "사번",
        width: 13,
        kind: "text",
        getRowValue:
          (row) =>
            row.employeeNo,
        getTotalValue:
          () =>
            "",
      },
    ];

  const showSales =
    metricGroup ===
      "all" ||
    metricGroup ===
      "sales";

  const showSubscription =
    metricGroup ===
      "all" ||
    metricGroup ===
      "subscription";

  const showConsultation =
    metricGroup ===
      "all" ||
    metricGroup ===
      "consultation";

  const showLead =
    metricGroup ===
      "all" ||
    metricGroup ===
      "lead";

  const showReview =
    metricGroup ===
      "all" ||
    metricGroup ===
      "review";

  if (showSales) {
    columns.push({
      key:
        "totalSalesAmount",
      header:
        "총판매금액",
      width: 16,
      kind: "amount",
      getRowValue:
        (row) =>
          row.totalSalesAmount,
      getTotalValue:
        (summary) =>
          summary.totalSalesAmount,
    });
  }

  if (showSubscription) {
    columns.push(
      {
        key:
          "subscriptionNetCount",
        header:
          "구독판매",
        width: 12,
        kind: "count",
        getRowValue:
          (row) =>
            row.subscriptionNetCount,
        getTotalValue:
          (summary) =>
            summary.subscriptionNetCount,
      },
      {
        key:
          "kyowonNetCount",
        header:
          "구독교원",
        width: 12,
        kind: "count",
        getRowValue:
          (row) =>
            row.kyowonNetCount,
        getTotalValue:
          (summary) =>
            summary.kyowonNetCount,
      }
    );
  }

  if (showConsultation) {
    columns.push(
      {
        key:
          "consultationCount",
        header:
          "상담건수",
        width: 12,
        kind: "count",
        getRowValue:
          (row) =>
            row.consultationCount,
        getTotalValue:
          (summary) =>
            summary.consultationCount,
      },
      {
        key:
          "consultationSalesCount",
        header:
          "판매건수",
        width: 12,
        kind: "count",
        getRowValue:
          (row) =>
            row.consultationSalesCount,
        getTotalValue:
          (summary) =>
            summary.consultationSalesCount,
      },
      {
        key:
          "consultationSuccessRate",
        header:
          "상담성공률",
        width: 13,
        kind: "rate",
        getRowValue:
          (row) =>
            toRateValue(
              row.consultationSuccessRate
            ),
        getTotalValue:
          (summary) =>
            toRateValue(
              summary.consultationSuccessRate
            ),
      }
    );
  }

  if (showLead) {
    columns.push(
      {
        key:
          "leadInCount",
        header:
          "가망객입수",
        width: 12,
        kind: "count",
        getRowValue:
          (row) =>
            row.leadInCount,
        getTotalValue:
          (summary) =>
            summary.leadInCount,
      },
      {
        key:
          "leadSuccessCount",
        header:
          "가망객성공",
        width: 12,
        kind: "count",
        getRowValue:
          (row) =>
            row.leadSuccessCount,
        getTotalValue:
          (summary) =>
            summary.leadSuccessCount,
      },
      {
        key:
          "leadSuccessRate",
        header:
          "가망객성공률",
        width: 13,
        kind: "rate",
        getRowValue:
          (row) =>
            toRateValue(
              row.leadSuccessRate
            ),
        getTotalValue:
          (summary) =>
            toRateValue(
              summary.leadSuccessRate
            ),
      }
    );
  }

  if (showReview) {
    for (
      const reviewMetric of
      snapshot.resolution
        .reviewMetrics
    ) {
      columns.push({
        key:
          `review:${reviewMetric.metricId}`,
        header:
          reviewMetric.name,
        width:
          Math.max(
            12,
            Math.min(
              20,
              reviewMetric.name.length +
                5
            )
          ),
        kind: "count",
        getRowValue:
          (row) =>
            row.reviewValues[
              reviewMetric.metricId
            ] ?? 0,
        getTotalValue:
          (summary) =>
            summary.reviewValues[
              reviewMetric.metricId
            ] ?? 0,
      });
    }

    columns.push({
      key:
        "reviewTotal",
      header:
        "후기합계",
      width: 12,
      kind: "count",
      getRowValue:
        (row) =>
          row.reviewTotal,
      getTotalValue:
        (summary) =>
          summary.reviewTotal,
    });
  }

  return columns;
}


function applyNumberFormats(
  worksheet: Record<
    string,
    unknown
  >,
  columns:
    ColumnDefinition[],
  firstDataRow: number,
  lastDataRow: number
) {
  const decodeCell =
    (
      columnIndex: number,
      rowIndex: number
    ) => {
      let value =
        columnIndex + 1;
      let letters = "";

      while (value > 0) {
        const remainder =
          (value - 1) % 26;

        letters =
          String.fromCharCode(
            65 + remainder
          ) + letters;

        value =
          Math.floor(
            (value - 1) / 26
          );
      }

      return `${letters}${rowIndex}`;
    };

  columns.forEach(
    (
      column,
      columnIndex
    ) => {
      if (
        column.kind ===
        "text"
      ) {
        return;
      }

      const numberFormat =
        column.kind ===
        "rate"
          ? "0.0%"
          : "#,##0";

      for (
        let rowIndex =
          firstDataRow;
        rowIndex <=
          lastDataRow;
        rowIndex += 1
      ) {
        const address =
          decodeCell(
            columnIndex,
            rowIndex
          );

        const cell =
          worksheet[
            address
          ] as
            | {
                z?: string;
              }
            | undefined;

        if (cell) {
          cell.z =
            numberFormat;
        }
      }
    }
  );
}


export async function downloadPerformanceAnalysisExcel({
  view,
  snapshot,
  rows,
  summary,
  metricGroup,
  selectedManagerNames,
}: ExportArgs) {
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "Excel 다운로드는 브라우저에서만 사용할 수 있습니다."
    );
  }

  if (
    rows.length === 0
  ) {
    throw new Error(
      "Excel로 다운로드할 실적이 없습니다."
    );
  }

  const XLSX =
    await import(
      "@e965/xlsx"
    );

  const columns =
    buildColumns(
      view,
      snapshot,
      metricGroup
    );

  const headerRow =
    columns.map(
      (column) =>
        column.header
    );

  const dataRows =
    rows.map(
      (row) =>
        columns.map(
          (column) =>
            column.getRowValue(
              row
            )
        )
    );

  const totalRow =
    columns.map(
      (column) =>
        column.getTotalValue(
          summary,
          selectedManagerNames.length
        )
    );

  const worksheet =
    XLSX.utils.aoa_to_sheet(
      [
        headerRow,
        ...dataRows,
        totalRow,
      ]
    );

  const firstDataRow = 2;
  const lastDataRow =
    rows.length + 2;

  applyNumberFormats(
    worksheet as unknown as
      Record<string, unknown>,
    columns,
    firstDataRow,
    lastDataRow
  );

  worksheet["!cols"] =
    columns.map(
      (column) => ({
        wch:
          column.width,
      })
    );

  if (
    rows.length > 0
  ) {
    const lastColumn =
      XLSX.utils.encode_col(
        columns.length - 1
      );

    worksheet[
      "!autofilter"
    ] = {
      ref:
        `A1:${lastColumn}${rows.length + 1}`,
    };
  }

  const conditionRows = [
    [
      "항목",
      "내용",
    ],
    [
      "분석구분",
      view ===
      "monthly"
        ? "월별내역"
        : "일자별내역",
    ],
    [
      "조회기간",
      `${snapshot.startDate} ~ ${snapshot.endDate}`,
    ],
    [
      "선택매니저",
      selectedManagerNames.join(
        ", "
      ) || "-",
    ],
    [
      "표시항목",
      groupLabel(
        metricGroup
      ),
    ],
    [
      "표시행",
      rows.length,
    ],
    [
      "관리자",
      "분석 대상에서 제외",
    ],
    [
      "성공률",
      "선택기간 전체의 분자·분모 합산 후 재계산",
    ],
    [
      "생성일시",
      new Intl.DateTimeFormat(
        "ko-KR",
        {
          timeZone:
            "Asia/Seoul",
          year:
            "numeric",
          month:
            "2-digit",
          day:
            "2-digit",
          hour:
            "2-digit",
          minute:
            "2-digit",
          second:
            "2-digit",
          hour12: false,
        }
      ).format(
        new Date()
      ),
    ],
  ];

  const conditionSheet =
    XLSX.utils.aoa_to_sheet(
      conditionRows
    );

  conditionSheet[
    "!cols"
  ] = [
    {
      wch: 15,
    },
    {
      wch: 48,
    },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    view === "monthly"
      ? "월별실적"
      : "일자별실적"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    conditionSheet,
    "조회조건"
  );

  const output =
    XLSX.write(
      workbook,
      {
        type: "array",
        bookType: "xlsx",
        compression: true,
      }
    ) as ArrayBuffer;

  const blob =
    new Blob(
      [output],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    );

  const objectUrl =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  const periodText =
    view ===
    "monthly"
      ? `${snapshot.startDate.slice(
          0,
          7
        )}_${snapshot.endDate.slice(
          0,
          7
        )}`
      : snapshot.startDate.slice(
          0,
          7
        );

  const fileName =
    safeFilePart(
      `원성점_실적분석_${
        view ===
        "monthly"
          ? "월별"
          : "일자별"
      }_${periodText}.xlsx`
    );

  anchor.href =
    objectUrl;

  anchor.download =
    fileName;

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl
      );
    },
    1000
  );
}
