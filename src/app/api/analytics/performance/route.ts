import {
  NextResponse,
} from "next/server";

import {
  loadPerformanceAnalysisSnapshot,
} from "@/lib/analytics/server";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: Request
) {
  const url =
    new URL(request.url);

  const startDate =
    url.searchParams.get(
      "start"
    ) ?? "";

  const endDate =
    url.searchParams.get(
      "end"
    ) ?? "";

  try {
    const snapshot =
      await loadPerformanceAnalysisSnapshot(
        startDate,
        endDate
      );

    return NextResponse.json(
      snapshot
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "실적 분석 데이터를 불러오지 못했습니다.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status:
          message.includes(
            "로그인"
          )
            ? 401
            : 400,
      }
    );
  }
}
