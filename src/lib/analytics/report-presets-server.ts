import {
  createClient,
} from "@/lib/supabase/server";

import {
  normalizeAnalysisReportPreset,
  validateAnalysisReportPresetPayload,
} from "@/lib/analytics/report-presets";

import type {
  AnalysisReportPreset,
  SaveAnalysisReportPresetPayload,
} from "@/lib/analytics/report-presets";


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
        "id,is_active"
      )
      .eq(
        "auth_user_id",
        userId
      )
      .maybeSingle();

  if (
    managerError ||
    !manager ||
    manager.is_active ===
      false
  ) {
    throw new Error(
      "사용중인 매니저 계정만 분석을 사용할 수 있습니다."
    );
  }

  return {
    supabase,
    userId,
  };
}


function databaseError(
  error: {
    code?: string | null;
    message?: string | null;
  } | null
) {
  if (!error) {
    return;
  }

  if (
    error.code ===
    "23505"
  ) {
    throw new Error(
      "같은 이름의 저장 보고서가 이미 있습니다."
    );
  }

  throw new Error(
    error.message ??
      "저장 보고서 처리 중 오류가 발생했습니다."
  );
}


export async function loadAnalysisReportPresets(): Promise<AnalysisReportPreset[]> {
  const {
    supabase,
    userId,
  } =
    await getSessionContext();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "analysis_report_presets"
      )
      .select("*")
      .eq(
        "owner_user_id",
        userId
      )
      .order(
        "is_default",
        {
          ascending:
            false,
        }
      )
      .order(
        "updated_at",
        {
          ascending:
            false,
        }
      );

  databaseError(
    error
  );

  return (
    data ?? []
  )
    .map(
      (row) =>
        normalizeAnalysisReportPreset(
          row as Record<
            string,
            unknown
          >
        )
    )
    .filter(
      (row) =>
        row.id !== ""
    );
}


export async function saveAnalysisReportPreset(
  payload:
    SaveAnalysisReportPresetPayload
): Promise<AnalysisReportPreset> {
  const normalized =
    validateAnalysisReportPresetPayload(
      payload
    );

  const {
    supabase,
    userId,
  } =
    await getSessionContext();

  const values = {
    name:
      normalized.name,
    granularity:
      normalized.granularity,
    start_month:
      normalized.startMonth,
    end_month:
      normalized.endMonth,
    manager_ids:
      normalized.managerIds,
    report_item_keys:
      normalized.reportItemKeys,
  };

  if (
    normalized.presetId
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "analysis_report_presets"
        )
        .update(
          values
        )
        .eq(
          "id",
          normalized.presetId
        )
        .eq(
          "owner_user_id",
          userId
        )
        .select("*")
        .maybeSingle();

    databaseError(
      error
    );

    if (!data) {
      throw new Error(
        "저장된 보고서를 찾을 수 없습니다."
      );
    }

    return normalizeAnalysisReportPreset(
      data as Record<
        string,
        unknown
      >
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "analysis_report_presets"
      )
      .insert({
        owner_user_id:
          userId,
        ...values,
      })
      .select("*")
      .single();

  databaseError(
    error
  );

  if (!data) {
    throw new Error(
      "저장 보고서를 생성하지 못했습니다."
    );
  }

  return normalizeAnalysisReportPreset(
    data as Record<
      string,
      unknown
    >
  );
}


export async function deleteAnalysisReportPreset(
  presetId: string
) {
  const {
    supabase,
    userId,
  } =
    await getSessionContext();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "analysis_report_presets"
      )
      .delete()
      .eq(
        "id",
        presetId
      )
      .eq(
        "owner_user_id",
        userId
      )
      .select("id")
      .maybeSingle();

  databaseError(
    error
  );

  if (!data) {
    throw new Error(
      "삭제할 저장 보고서를 찾을 수 없습니다."
    );
  }
}


export async function setDefaultAnalysisReportPreset(
  presetId: string
) {
  const {
    supabase,
  } =
    await getSessionContext();

  const {
    error,
  } =
    await supabase.rpc(
      "set_analysis_report_preset_default",
      {
        p_preset_id:
          presetId,
      }
    );

  databaseError(
    error
  );
}
