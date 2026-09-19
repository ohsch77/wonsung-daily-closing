import {
  NextResponse,
} from "next/server";

import {
  deleteAnalysisMetric,
  loadAnalysisMetricLibrary,
  previewAnalysisMetric,
  saveAnalysisMetric,
  setAnalysisMetricActive,
} from "@/lib/analytics/metric-library-server";

import type {
  PreviewAnalysisMetricPayload,
  SaveAnalysisMetricPayload,
} from "@/lib/analytics/metric-library";


export const dynamic =
  "force-dynamic";


function errorResponse(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "분석항목 처리 중 오류가 발생했습니다.";

  const status =
    message.includes(
      "로그인"
    )
      ? 401
      : message.includes(
          "관리자"
        )
        ? 403
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


export async function GET() {
  try {
    const snapshot =
      await loadAnalysisMetricLibrary();

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
    return errorResponse(
      error
    );
  }
}


type PostBody =
  | {
      action: "save";
      payload:
        SaveAnalysisMetricPayload;
    }
  | {
      action: "set-active";
      metricId: string;
      isActive: boolean;
    }
  | {
      action: "delete";
      metricId: string;
    }
  | {
      action: "preview";
      payload:
        PreviewAnalysisMetricPayload;
    };


export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json() as
        PostBody;

    if (
      body.action ===
      "save"
    ) {
      const metricId =
        await saveAnalysisMetric(
          body.payload
        );

      const snapshot =
        await loadAnalysisMetricLibrary();

      return NextResponse.json({
        metricId,
        snapshot,
      });
    }

    if (
      body.action ===
      "set-active"
    ) {
      const result =
        await setAnalysisMetricActive(
          body.metricId,
          body.isActive
        );

      const snapshot =
        await loadAnalysisMetricLibrary();

      return NextResponse.json({
        result,
        snapshot,
      });
    }

    if (
      body.action ===
      "delete"
    ) {
      const result =
        await deleteAnalysisMetric(
          body.metricId
        );

      const snapshot =
        await loadAnalysisMetricLibrary();

      return NextResponse.json({
        result,
        snapshot,
      });
    }

    if (
      body.action ===
      "preview"
    ) {
      const preview =
        await previewAnalysisMetric(
          body.payload
        );

      return NextResponse.json({
        preview,
      });
    }

    return NextResponse.json(
      {
        error:
          "지원하지 않는 분석항목 작업입니다.",
      },
      {
        status: 400,
      }
    );
  }
  catch (error) {
    return errorResponse(
      error
    );
  }
}
