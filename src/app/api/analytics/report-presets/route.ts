import {
  NextResponse,
} from "next/server";

import {
  deleteAnalysisReportPreset,
  loadAnalysisReportPresets,
  saveAnalysisReportPreset,
  setDefaultAnalysisReportPreset,
} from "@/lib/analytics/report-presets-server";

import type {
  SaveAnalysisReportPresetPayload,
} from "@/lib/analytics/report-presets";


export const dynamic =
  "force-dynamic";


function errorResponse(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : "저장 보고서 처리 중 오류가 발생했습니다.";

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


export async function GET() {
  try {
    const presets =
      await loadAnalysisReportPresets();

    return NextResponse.json(
      {
        presets,
      },
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
        SaveAnalysisReportPresetPayload;
    }
  | {
      action: "delete";
      presetId: string;
    }
  | {
      action: "set-default";
      presetId: string;
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
      const preset =
        await saveAnalysisReportPreset(
          body.payload
        );

      const presets =
        await loadAnalysisReportPresets();

      return NextResponse.json({
        preset,
        presets,
      });
    }

    if (
      body.action ===
      "delete"
    ) {
      await deleteAnalysisReportPreset(
        body.presetId
      );

      const presets =
        await loadAnalysisReportPresets();

      return NextResponse.json({
        presets,
      });
    }

    if (
      body.action ===
      "set-default"
    ) {
      await setDefaultAnalysisReportPreset(
        body.presetId
      );

      const presets =
        await loadAnalysisReportPresets();

      return NextResponse.json({
        presets,
      });
    }

    return NextResponse.json(
      {
        error:
          "지원하지 않는 저장 보고서 작업입니다.",
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
