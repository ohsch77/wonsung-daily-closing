import type {
  SystemCompareDataset,
  SystemCompareRow,
  SystemCompareSnapshot,
  SystemCompareStatus,
} from "@/lib/analytics/system-compare";


type Args = {
  dataset:
    SystemCompareDataset;
  snapshot:
    SystemCompareSnapshot;
  rows:
    SystemCompareRow[];
  selectedManagerNames:
    string[];
};


function statusText(
  status:
    SystemCompareStatus
) {
  switch (status) {
    case "match":
      return "일치";
    case "mismatch":
      return "불일치";
    case "missing-daily":
      return "일실적 없음";
    case "missing-system":
      return "전산실적 없음";
    default:
      return "자료 없음";
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


export async function downloadSystemCompareExcel({
  dataset,
  snapshot,
  rows,
  selectedManagerNames,
}: Args) {
  if (
    typeof window ===
    "undefined"
  ) {
    throw new Error(
      "Excel 다운로드는 브라우저에서만 사용할 수 있습니다."
    );
  }

  if (
    rows.length ===
    0
  ) {
    throw new Error(
      "Excel로 다운로드할 비교 결과가 없습니다."
    );
  }

  const XLSX =
    await import(
      "@e965/xlsx"
    );

  const header = [
    "일자",
    "매니저",
    "사번",
    "일실적 총판매",
    dataset ===
    "sales"
      ? "전산 사원별판매"
      : "전산 사원별매출",
    "차이(일실적-전산)",
    "판정",
  ];

  const data =
    rows.map(
      (row) => {
        const systemAmount =
          dataset ===
          "sales"
            ? row.systemSalesAmount
            : row.systemRevenueAmount;

        const difference =
          dataset ===
          "sales"
            ? row.salesDifference
            : row.revenueDifference;

        const status =
          dataset ===
          "sales"
            ? row.salesStatus
            : row.revenueStatus;

        return [
          row.reportDate,
          row.managerName,
          row.employeeNo,
          row.dailyTotalSalesAmount,
          systemAmount,
          difference,
          statusText(
            status
          ),
        ];
      }
    );

  const sheet =
    XLSX.utils.aoa_to_sheet(
      [
        header,
        ...data,
      ]
    );

  sheet["!cols"] = [
    { wch: 13 },
    { wch: 14 },
    { wch: 13 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
  ];

  const lastRow =
    rows.length + 1;

  for (
    let rowIndex = 2;
    rowIndex <=
      lastRow;
    rowIndex += 1
  ) {
    for (
      const column of
      ["D", "E", "F"]
    ) {
      const cell =
        sheet[
          `${column}${rowIndex}`
        ] as
          | {
              z?: string;
            }
          | undefined;

      if (
        cell
      ) {
        cell.z =
          "#,##0";
      }
    }
  }

  sheet["!autofilter"] = {
    ref:
      `A1:G${lastRow}`,
  };

  const conditions =
    XLSX.utils.aoa_to_sheet(
      [
        [
          "항목",
          "내용",
        ],
        [
          "조회기간",
          `${snapshot.startDate} ~ ${snapshot.endDate}`,
        ],
        [
          "비교기준",
          dataset ===
          "sales"
            ? "사원별 판매 당일실적"
            : "사원별 매출 당일실적",
        ],
        [
          "차이계산",
          "일실적 총판매 - 전산실적",
        ],
        [
          "선택매니저",
          selectedManagerNames.join(
            ", "
          ) || "-",
        ],
        [
          "비교행",
          rows.length,
        ],
        [
          "관리자",
          "매니저 비교 대상에서 제외",
        ],
        [
          "전산자료",
          "status=applied, is_current=true, snapshot_type=current만 사용",
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
              hour12:
                false,
            }
          ).format(
            new Date()
          ),
        ],
      ]
    );

  conditions["!cols"] = [
    { wch: 16 },
    { wch: 54 },
  ];

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    sheet,
    "전산비교"
  );

  XLSX.utils.book_append_sheet(
    workbook,
    conditions,
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

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    safeFilePart(
      `원성점_전산비교_${
        dataset ===
        "sales"
          ? "사원별판매"
          : "사원별매출"
      }_${snapshot.startDate.slice(
        0,
        7
      )}.xlsx`
    );

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}
