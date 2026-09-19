"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Download,
  Image as ImageIcon,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";


type ValuePair = {
  daily: number;
  mtd: number;
};


type ReportManager = {
  manager_id: string;
  employee_no: string | null;
  manager_name: string;
  display_order: number;

  sales: {
    store: ValuePair;
    outside: ValuePair;
    cancel: ValuePair;
    total: ValuePair;
  };

  subscription: {
    general: {
      sales: ValuePair;
      cancel: ValuePair;
      total: ValuePair;
    };
    kyowon: {
      sales: ValuePair;
      cancel: ValuePair;
      total: ValuePair;
    };
  };

  newbest: {
    sales: ValuePair;
    revenue: ValuePair;
  };

  counseling: {
    count: ValuePair;
    sales_count: ValuePair;
    success_rate: ValuePair;
  };

  lead: {
    in: ValuePair;
    success: ValuePair;
    success_rate: ValuePair;
  };

  payment: {
    cash: ValuePair;
    card_approval: ValuePair;
    card_cancel: ValuePair;
    total: ValuePair;
  };

  review: {
    wedding_cafe: ValuePair;
    blog: ValuePair;
    movein_cafe: ValuePair;
    group_chat: ValuePair;
    naver: ValuePair;
    total: ValuePair;
  };
};


type ClosingReportPayload = {
  report_date: string;
  month_start: string;
  manager_count: number;
  closing: {
    status: string;
    is_closed: boolean;
    revision_no: number;
    first_closed_at: string | null;
    last_closed_at: string | null;
  };
  managers: ReportManager[];
  totals: Omit<
    ReportManager,
    | "manager_id"
    | "employee_no"
    | "manager_name"
    | "display_order"
  >;
};


type Props = {
  reportDate: string;
  isClosed: boolean;
  refreshKey?: string | number;
};


type UnitType =
  | "amount"
  | "count"
  | "percent";


type ReportRow = {
  label: string;
  path: string;
  unit: UnitType;
  emphasize?: boolean;
  emphasizeKind?: "total" | "rate";
  dividerBefore?: boolean;
};


type ReportSection = {
  section: string;
  rows: ReportRow[];
};


const REPORT_SECTIONS: ReportSection[] = [
  {
    section: "판매",
    rows: [
      {
        label: "매장",
        path: "sales.store",
        unit: "amount",
      },
      {
        label: "외부",
        path: "sales.outside",
        unit: "amount",
      },
      {
        label: "취소",
        path: "sales.cancel",
        unit: "amount",
      },
      {
        label: "합계",
        path: "sales.total",
        unit: "amount",
        emphasize: true,
        emphasizeKind: "total",
      },
    ],
  },
  {
    section: "구독실적",
    rows: [
      {
        label: "구독판매",
        path: "subscription.general.sales",
        unit: "count",
      },
      {
        label: "구독취소",
        path: "subscription.general.cancel",
        unit: "count",
      },
      {
        label: "구독합계",
        path: "subscription.general.total",
        unit: "count",
        emphasize: true,
        emphasizeKind: "total",
      },
    ],
  },
  {
    section: "교원실적",
    rows: [
      {
        label: "교원판매",
        path: "subscription.kyowon.sales",
        unit: "count",
      },
      {
        label: "교원취소",
        path: "subscription.kyowon.cancel",
        unit: "count",
      },
      {
        label: "교원합계",
        path: "subscription.kyowon.total",
        unit: "count",
        emphasize: true,
        emphasizeKind: "total",
      },
    ],
  },
  {
    section: "NewBEST\n(VAT별도)",
    rows: [
      {
        label: "판매",
        path: "newbest.sales",
        unit: "amount",
      },
      {
        label: "매출",
        path: "newbest.revenue",
        unit: "amount",
      },
    ],
  },
  {
    section: "상담관리",
    rows: [
      {
        label: "상담건수",
        path: "counseling.count",
        unit: "count",
      },
      {
        label: "판매건수",
        path: "counseling.sales_count",
        unit: "count",
      },
      {
        label: "성공률",
        path: "counseling.success_rate",
        unit: "percent",
        emphasize: true,
        emphasizeKind: "rate",
      },
    ],
  },
  {
    section: "추적관리",
    rows: [
      {
        label: "입수건수",
        path: "lead.in",
        unit: "count",
      },
      {
        label: "성공건수",
        path: "lead.success",
        unit: "count",
      },
      {
        label: "성공률",
        path: "lead.success_rate",
        unit: "percent",
        emphasize: true,
        emphasizeKind: "rate",
      },
    ],
  },
  {
    section: "결제금액",
    rows: [
      {
        label: "현금결제",
        path: "payment.cash",
        unit: "amount",
      },
      {
        label: "카드결제",
        path: "payment.card_approval",
        unit: "amount",
      },
      {
        label: "취소금액",
        path: "payment.card_cancel",
        unit: "amount",
      },
      {
        label: "결제합계",
        path: "payment.total",
        unit: "amount",
        emphasize: true,
        emphasizeKind: "total",
      },
    ],
  },
  {
    section: "후기관리",
    rows: [
      {
        label: "웨딩카페",
        path: "review.wedding_cafe",
        unit: "count",
      },
      {
        label: "블로그",
        path: "review.blog",
        unit: "count",
      },
      {
        label: "입주카페",
        path: "review.movein_cafe",
        unit: "count",
      },
      {
        label: "단톡방",
        path: "review.group_chat",
        unit: "count",
      },
      {
        label: "네이버리뷰",
        path: "review.naver",
        unit: "count",
      },
      {
        label: "합계",
        path: "review.total",
        unit: "count",
        emphasize: true,
        emphasizeKind: "total",
      },
    ],
  },
];


function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function getPair(
  source: unknown,
  path: string
): ValuePair {
  const parts = path.split(".");
  let current = source as Record<string, unknown> | null;

  for (const part of parts) {
    if (
      !current ||
      typeof current !== "object"
    ) {
      return {
        daily: 0,
        mtd: 0,
      };
    }

    current = current[
      part
    ] as Record<string, unknown> | null;
  }

  if (
    !current ||
    typeof current !== "object"
  ) {
    return {
      daily: 0,
      mtd: 0,
    };
  }

  return {
    daily: numberValue(
      current.daily
    ),
    mtd: numberValue(
      current.mtd
    ),
  };
}


function formatValue(
  value: number,
  unit: UnitType
) {
  if (value === 0) {
    return "";
  }

  if (unit === "percent") {
    return `${value.toLocaleString(
      "ko-KR",
      {
        minimumFractionDigits:
          Number.isInteger(value)
            ? 0
            : 1,
        maximumFractionDigits: 1,
      }
    )}%`;
  }

  if (unit === "amount") {
    const kk =
      value / 1_000_000;

    return kk.toLocaleString(
      "ko-KR",
      {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }
    );
  }

  return value.toLocaleString(
    "ko-KR",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }
  );
}


function getDateTitle(
  reportDate: string
) {
  const date = new Date(
    `${reportDate}T00:00:00+09:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return reportDate;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }
  ).format(date);
}


function drawReportCanvas(
  payload: ClosingReportPayload
) {
  const scale = 2;

  const pageMargin = 34;
  const titleHeight = 96;
  const headerTopHeight = 46;
  const headerBottomHeight = 36;
  const rowHeight = 36;
  const sectionWidth = 108;
  const itemWidth = 144;
  const valueWidth = 102;

  const managers =
    payload.managers ?? [];

  const bodyRowCount =
    REPORT_SECTIONS.reduce(
      (
        count,
        section
      ) =>
        count +
        section.rows.length,
      0
    );

  const valueColumnCount =
    (managers.length + 1) *
    2;

  const tableWidth =
    sectionWidth +
    itemWidth +
    valueWidth *
      valueColumnCount;

  const logicalWidth =
    tableWidth +
    pageMargin * 2;

  const logicalHeight =
    pageMargin +
    titleHeight +
    headerTopHeight +
    headerBottomHeight +
    bodyRowCount *
      rowHeight +
    pageMargin;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    logicalWidth * scale;
  canvas.height =
    logicalHeight * scale;

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    throw new Error(
      "마감보고 이미지를 생성할 수 없습니다."
    );
  }

  context.scale(
    scale,
    scale
  );

  const colors = {
    page: "#FFFFFF",
    border: "#C7CCD2",
    strongBorder: "#8C939B",
    title: "#20242A",
    lgRed: "#A50034",
    header: "#3E444B",
    headerText: "#FFFFFF",
    subHeader: "#EEF1F4",
    section: "#F1F3F5",
    body: "#FFFFFF",
    totalRow: "#F6EFE6",
    rateRow: "#EEF4F8",
    totalColumn: "#FFF0DA",
    totalColumnStrong: "#FBE7C8",
    text: "#252A31",
    muted: "#69717A",
    divider: "#9EA5AD",
    sectionDivider: "#7E868F",
  };

  const fontFamily =
    "'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

  context.fillStyle =
    colors.page;
  context.fillRect(
    0,
    0,
    logicalWidth,
    logicalHeight
  );

  const drawRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke = colors.border,
    lineWidth = 1
  ) => {
    context.fillStyle = fill;
    context.fillRect(
      x,
      y,
      width,
      height
    );

    context.strokeStyle =
      stroke;
    context.lineWidth =
      lineWidth;
    context.strokeRect(
      x,
      y,
      width,
      height
    );
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      size?: number;
      weight?: number;
      color?: string;
      align?: CanvasTextAlign;
      padding?: number;
    } = {}
  ) => {
    const {
      size = 16,
      weight = 700,
      color = colors.text,
      align = "center",
      padding = 8,
    } = options;

    context.fillStyle = color;
    context.font = `${weight} ${size}px ${fontFamily}`;
    context.textAlign = align;
    context.textBaseline =
      "middle";

    const textX =
      align === "left"
        ? x + padding
        : align === "right"
          ? x + width - padding
          : x + width / 2;

    const lines =
      String(text)
        .split("\n");

    if (
      lines.length === 1
    ) {
      context.fillText(
        lines[0],
        textX,
        y + height / 2
      );

      return;
    }

    const lineHeight =
      size * 1.15;
    const totalLineHeight =
      lineHeight *
      lines.length;
    const startY =
      y +
      height / 2 -
      totalLineHeight / 2 +
      lineHeight / 2;

    lines.forEach(
      (
        line,
        index
      ) => {
        context.fillText(
          line,
          textX,
          startY +
            index *
              lineHeight
        );
      }
    );
  };

  const tableX =
    pageMargin;
  const titleY =
    pageMargin;
  const tableY =
    titleY +
    titleHeight;

  context.fillStyle =
    colors.lgRed;
  context.fillRect(
    tableX,
    titleY + 4,
    5,
    54
  );

  context.fillStyle =
    colors.title;
  context.font =
    `900 27px ${fontFamily}`;
  context.textAlign = "left";
  context.textBaseline =
    "alphabetic";
  context.fillText(
    "원성점 지점 마감보고",
    tableX + 20,
    titleY + 38
  );

  context.fillStyle =
    colors.muted;
  context.font =
    `700 16px ${fontFamily}`;
  context.fillText(
    getDateTitle(
      payload.report_date
    ),
    tableX + 20,
    titleY + 67
  );

  context.textAlign =
    "right";
  context.font =
    `700 13px ${fontFamily}`;
  context.fillText(
    "단위 : KK, 건, %",
    tableX +
      tableWidth,
    titleY + 66
  );

  const leftWidth =
    sectionWidth +
    itemWidth;

  drawRect(
    tableX,
    tableY,
    leftWidth,
    headerTopHeight +
      headerBottomHeight,
    colors.header,
    colors.strongBorder,
    1.3
  );

  drawText(
    "구분",
    tableX,
    tableY,
    leftWidth,
    headerTopHeight +
      headerBottomHeight,
    {
      size: 16,
      weight: 900,
      color:
        colors.headerText,
    }
  );

  let headerX =
    tableX +
    leftWidth;

  for (
    const manager of
    managers
  ) {
    drawRect(
      headerX,
      tableY,
      valueWidth * 2,
      headerTopHeight,
      colors.header,
      colors.strongBorder,
      1.3
    );

    drawText(
      manager.manager_name,
      headerX,
      tableY,
      valueWidth * 2,
      headerTopHeight,
      {
        size: 16,
        weight: 900,
        color:
          colors.headerText,
      }
    );

    drawRect(
      headerX,
      tableY +
        headerTopHeight,
      valueWidth,
      headerBottomHeight,
      colors.subHeader,
      colors.border
    );

    drawText(
      "당일",
      headerX,
      tableY +
        headerTopHeight,
      valueWidth,
      headerBottomHeight,
      {
        size: 13,
        weight: 900,
      }
    );

    drawRect(
      headerX +
        valueWidth,
      tableY +
        headerTopHeight,
      valueWidth,
      headerBottomHeight,
      colors.subHeader,
      colors.border
    );

    drawText(
      "누적",
      headerX +
        valueWidth,
      tableY +
        headerTopHeight,
      valueWidth,
      headerBottomHeight,
      {
        size: 13,
        weight: 900,
      }
    );

    headerX +=
      valueWidth * 2;
  }

  drawRect(
    headerX,
    tableY,
    valueWidth * 2,
    headerTopHeight,
    "#C97820",
    colors.strongBorder,
    1.3
  );

  drawText(
    "합계금액",
    headerX,
    tableY,
    valueWidth * 2,
    headerTopHeight,
    {
      size: 17,
      weight: 900,
      color:
        colors.headerText,
    }
  );

  drawRect(
    headerX,
    tableY +
      headerTopHeight,
    valueWidth,
    headerBottomHeight,
    colors.totalColumn,
    colors.border
  );

  drawText(
    "당일",
    headerX,
    tableY +
      headerTopHeight,
    valueWidth,
    headerBottomHeight,
    {
      size: 14,
      weight: 900,
    }
  );

  drawRect(
    headerX +
      valueWidth,
    tableY +
      headerTopHeight,
    valueWidth,
    headerBottomHeight,
    colors.totalColumn,
    colors.border
  );

  drawText(
    "누적",
    headerX +
      valueWidth,
    tableY +
      headerTopHeight,
    valueWidth,
    headerBottomHeight,
    {
      size: 14,
      weight: 900,
    }
  );

  let rowY =
    tableY +
    headerTopHeight +
    headerBottomHeight;

  for (
    const section of
    REPORT_SECTIONS
  ) {
    const sectionHeight =
      section.rows.length *
      rowHeight;

    drawRect(
      tableX,
      rowY,
      sectionWidth,
      sectionHeight,
      colors.section,
      colors.border,
      1
    );

    drawText(
      section.section,
      tableX,
      rowY,
      sectionWidth,
      sectionHeight,
      {
        size: 14,
        weight: 900,
      }
    );

    section.rows.forEach(
      (
        row,
        rowIndex
      ) => {
        const currentY =
          rowY +
          rowIndex *
            rowHeight;

        const rowFill =
          row.emphasizeKind === "rate"
            ? colors.rateRow
            : row.emphasize
              ? colors.totalRow
              : colors.body;

        if (row.dividerBefore) {
          context.strokeStyle =
            colors.divider;
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(
            tableX + sectionWidth,
            currentY
          );
          context.lineTo(
            tableX + tableWidth,
            currentY
          );
          context.stroke();
        }

        drawRect(
          tableX +
            sectionWidth,
          currentY,
          itemWidth,
          rowHeight,
          rowFill,
          colors.border
        );

        drawText(
          row.label,
          tableX +
            sectionWidth,
          currentY,
          itemWidth,
          rowHeight,
          {
            size: 13,
            weight:
              row.emphasize
                ? 900
                : 700,
            align: "left",
            padding: 13,
          }
        );

        let valueX =
          tableX +
          sectionWidth +
          itemWidth;

        for (
          const manager of
          managers
        ) {
          const pair =
            getPair(
              manager,
              row.path
            );

          for (
            const value of [
              pair.daily,
              pair.mtd,
            ]
          ) {
            drawRect(
              valueX,
              currentY,
              valueWidth,
              rowHeight,
              rowFill,
              colors.border
            );

            drawText(
              formatValue(
                value,
                row.unit
              ),
              valueX,
              currentY,
              valueWidth,
              rowHeight,
              {
                size: 12,
                weight:
                  row.emphasize
                    ? 900
                    : 700,
                align: "right",
                padding: 11,
              }
            );

            valueX +=
              valueWidth;
          }
        }

        const totalPair =
          getPair(
            payload.totals,
            row.path
          );

        for (
          const value of [
            totalPair.daily,
            totalPair.mtd,
          ]
        ) {
          drawRect(
            valueX,
            currentY,
            valueWidth,
            rowHeight,
            row.emphasize
              ? colors.totalColumnStrong
              : colors.totalColumn,
            colors.border
          );

          drawText(
            formatValue(
              value,
              row.unit
            ),
            valueX,
            currentY,
            valueWidth,
            rowHeight,
            {
              size: 12,
              weight: 900,
              align: "right",
              padding: 11,
            }
          );

          valueX +=
            valueWidth;
        }
      }
    );

    rowY +=
      sectionHeight;
  }

  /*
   * 최종 경계선 정리
   *
   * 같은 위치에 굵은 선을 여러 번 겹쳐 그리지 않고,
   * 헤더 하단과 각 대분류 경계는 마지막에 한 번만
   * 표 전체 폭으로 동일한 두께로 그립니다.
   */
  const bodyTop =
    tableY +
    headerTopHeight +
    headerBottomHeight;

  const bodyBottom =
    bodyTop +
    bodyRowCount *
      rowHeight;

  const majorLineWidth =
    1.5;

  /*
   * '구분' 헤더 아래 경계선 + 모든 대분류 경계선
   */
  const majorHorizontalYs:
    number[] = [
      bodyTop,
    ];

  let sectionBoundaryY =
    bodyTop;

  for (
    const section of
    REPORT_SECTIONS
  ) {
    sectionBoundaryY +=
      section.rows.length *
        rowHeight;

    majorHorizontalYs.push(
      sectionBoundaryY
    );
  }

  context.strokeStyle =
    colors.sectionDivider;
  context.lineWidth =
    majorLineWidth;

  for (
    const boundaryY of
    majorHorizontalYs
  ) {
    context.beginPath();
    context.moveTo(
      tableX,
      boundaryY
    );
    context.lineTo(
      tableX +
        tableWidth,
      boundaryY
    );
    context.stroke();
  }

  /*
   * 좌측 구분 / 항목명 경계
   */
  context.lineWidth = 1.2;

  context.beginPath();
  context.moveTo(
    tableX +
      sectionWidth,
    bodyTop
  );
  context.lineTo(
    tableX +
      sectionWidth,
    bodyBottom
  );
  context.stroke();

  context.beginPath();
  context.moveTo(
    tableX +
      sectionWidth +
      itemWidth,
    tableY
  );
  context.lineTo(
    tableX +
      sectionWidth +
      itemWidth,
    bodyBottom
  );
  context.stroke();

  /*
   * 각 매니저의 당일 + 누적 2열 그룹 경계
   */
  let groupBoundaryX =
    tableX +
    sectionWidth +
    itemWidth +
    valueWidth * 2;

  for (
    let groupIndex = 0;
    groupIndex <
    managers.length;
    groupIndex += 1
  ) {
    context.beginPath();
    context.moveTo(
      groupBoundaryX,
      tableY
    );
    context.lineTo(
      groupBoundaryX,
      bodyBottom
    );
    context.stroke();

    groupBoundaryX +=
      valueWidth * 2;
  }

  /*
   * 표 외곽선도 대분류 경계선과 동일한 두께로 통일
   */
  context.strokeStyle =
    colors.sectionDivider;
  context.lineWidth =
    majorLineWidth;
  context.strokeRect(
    tableX,
    tableY,
    tableWidth,
    headerTopHeight +
      headerBottomHeight +
      bodyRowCount *
        rowHeight
  );

  return canvas;
}


export default function ClosingReportCard({
  reportDate,
  isClosed,
  refreshKey = 0,
}: Props) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [payload, setPayload] =
    useState<ClosingReportPayload | null>(
      null
    );
  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [downloading, setDownloading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);


  const loadPayload =
    useCallback(
      async () => {
        if (!isClosed) {
          setPayload(null);
          setPreviewUrl(null);
          setErrorMessage(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setErrorMessage(null);

        try {
          const result =
            await supabase.rpc(
              "get_closing_report_payload",
              {
                p_report_date:
                  reportDate,
              }
            );

          if (result.error) {
            throw result.error;
          }

          const nextPayload =
            result.data as ClosingReportPayload;

          if (
            !nextPayload ||
            nextPayload.closing
              ?.is_closed !== true
          ) {
            throw new Error(
              "마감이 완료된 날짜만 보고카드를 생성할 수 있습니다."
            );
          }

          setPayload(
            nextPayload
          );
        }
        catch (error) {
          setPayload(null);
          setPreviewUrl(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "마감보고 데이터를 불러오지 못했습니다."
          );
        }
        finally {
          setLoading(false);
        }
      },
      [
        isClosed,
        reportDate,
        supabase,
      ]
    );


  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadPayload();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    loadPayload,
    refreshKey,
  ]);


  useEffect(() => {
    if (!payload) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          try {
            const canvas =
              drawReportCanvas(
                payload
              );

            setPreviewUrl(
              canvas.toDataURL(
                "image/png"
              )
            );
          }
          catch (error) {
            setPreviewUrl(null);
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "마감보고 이미지를 생성하지 못했습니다."
            );
          }
        },
        0
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [payload]);


  const downloadPng =
    useCallback(
      async () => {
        if (
          !payload ||
          downloading
        ) {
          return;
        }

        setDownloading(true);
        setErrorMessage(null);

        try {
          const canvas =
            drawReportCanvas(
              payload
            );

          const blob =
            await new Promise<Blob | null>(
              (resolve) => {
                canvas.toBlob(
                  resolve,
                  "image/png"
                );
              }
            );

          if (!blob) {
            throw new Error(
              "PNG 파일을 생성하지 못했습니다."
            );
          }

          const objectUrl =
            URL.createObjectURL(
              blob
            );

          const anchor =
            document.createElement(
              "a"
            );

          anchor.href =
            objectUrl;
          anchor.download =
            `원성점_마감보고_${payload.report_date}.png`;

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
            1500
          );
        }
        catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "PNG 다운로드 중 오류가 발생했습니다."
          );
        }
        finally {
          setDownloading(false);
        }
      },
      [
        downloading,
        payload,
      ]
    );


  return (
    <section className="overflow-hidden rounded-[22px] border border-[#E5E7EA] bg-white">
      <div className="border-b border-[#ECEEF1] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#A50034]">
              <ImageIcon size={17} />
              <span className="text-[11px] font-black tracking-[0.08em]">
                CLOSING REPORT CARD
              </span>
            </div>

            <h3 className="mt-2 text-[20px] font-black tracking-[-0.03em] text-[#292C31]">
              지점 마감보고 카드
            </h3>

            <p className="mt-1 text-[12px] leading-5 text-[#858A92]">
              마감완료 데이터를 가로형 한 장으로 자동 정리합니다. 금액은 KK 단위이며, 0값은 빈칸으로 표시됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void downloadPng()
            }
            disabled={
              !isClosed ||
              !payload ||
              !previewUrl ||
              loading ||
              downloading
            }
            className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#A50034] px-4 text-[11px] font-black text-white transition hover:bg-[#8E002D] disabled:cursor-not-allowed disabled:bg-[#D8DADD] disabled:text-[#92969D]"
          >
            {downloading ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
              />
            ) : (
              <Download size={15} />
            )}
            마감보고 PNG 다운로드
          </button>
        </div>
      </div>

      {!isClosed ? (
        <div className="flex min-h-[180px] items-center justify-center bg-[#FAFAFB] px-5 py-10">
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F1F3] text-[#7F848C]">
              <LockKeyhole size={17} />
            </div>
            <p className="mt-3 text-[12px] font-black text-[#5F646C]">
              마감 완료 후 보고카드가 생성됩니다.
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[#969AA2]">
              수정중인 날짜는 재마감 후 PNG를 다운로드할 수 있습니다.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex min-h-[220px] items-center justify-center bg-[#FAFAFB]">
          <span className="inline-flex items-center gap-2 text-[12px] font-black text-[#858A92]">
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
            마감보고 카드 생성 중
          </span>
        </div>
      ) : errorMessage ? (
        <div className="px-5 py-6 sm:px-6">
          <div className="rounded-[14px] border border-[#F0CDD3] bg-[#FFF5F6] px-4 py-3 text-[11px] font-bold leading-5 text-[#A50034]">
            {errorMessage}
          </div>
        </div>
      ) : previewUrl ? (
        <div className="bg-[#F3F4F6] p-3 sm:p-5">
          <div className="overflow-x-auto rounded-[12px] border border-[#DDE0E4] bg-white shadow-sm">
            <img
              src={previewUrl}
              alt={`${reportDate} 원성점 지점 마감보고`}
              className="block h-auto min-w-[980px] max-w-none lg:min-w-full lg:max-w-full"
            />
          </div>

          <p className="mt-3 text-center text-[10px] font-bold text-[#969AA2] sm:text-left">
            모바일에서는 가로로 스크롤해 확인할 수 있으며, 다운로드 파일은 고해상도 PNG로 저장됩니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}
