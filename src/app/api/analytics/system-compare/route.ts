import {
  NextResponse,
} from "next/server";

import {
  loadSystemCompareSnapshot,
} from "@/lib/analytics/system-compare-server";


export const dynamic =
  "force-dynamic";


export async function GET(
  request: Request
) {
  const url =
    new URL(
      request.url
    );

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
      await loadSystemCompareSnapshot(
        startDate,
        endDate
      );

    return NextResponse.json(
      snapshot,
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "전산 비교 데이터를 불러오지 못했습니다.";

    const status =
      message.includes(
        "로그인"
      )
        ? 401
        : 400;

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status,
      }
    );
  }
}
