"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  SystemPerformanceDatasetType,
  SystemPerformanceSnapshotType,
} from "@/types/system-performance";


type HistoryTarget = {
  reportDate: string;
  datasetType: SystemPerformanceDatasetType;
  datasetTitle: string;
  snapshotType: SystemPerformanceSnapshotType;
  snapshotTitle: string;
  locked: boolean;
};


type VersionRow = {
  id: string;
  report_date: string;
  dataset_type: string;
  snapshot_type: string;
  version_no: number;
  status: string;
  is_current: boolean;
  row_count: number;
  source_method: string | null;
  source_file_name: string | null;
  source_sheet_name: string | null;
  created_at: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
  restored_from_batch_id: string | null;
};


type Props = {
  target: HistoryTarget;
  onClose: () => void;
  onRestored: (message: string) => void;
};


function formatCreatedAt(
  value: string | null
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}


function getSourceLabel(
  sourceMethod: string | null
) {
  switch (sourceMethod) {
    case "upload":
      return "Excel 업로드";

    case "paste":
      return "붙여넣기";

    case "manual":
      return "직접입력";

    default:
      return "-";
  }
}


function getStatusInfo(
  row: VersionRow
) {
  if (
    row.status === "applied" &&
    row.is_current
  ) {
    return {
      label: "현재 적용",
      className: "bg-[#EDF8F1] text-[#287348]",
      Icon: CheckCircle2,
    };
  }

  if (row.status === "applied") {
    return {
      label: "과거 적용",
      className: "bg-[#F2F3F5] text-[#6C727B]",
      Icon: History,
    };
  }

  if (row.status === "deleted") {
    return {
      label: "삭제 이력",
      className: "bg-[#FFF1F3] text-[#A14B5D]",
      Icon: Trash2,
    };
  }

  return {
    label: row.status || "이력",
    className: "bg-[#FFF7E8] text-[#9A6513]",
    Icon: Clock3,
  };
}


export default function SystemPerformanceHistoryModal({
  target,
  onClose,
  onRestored,
}: Props) {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVersions = async () => {
      setLoading(true);
      setErrorMessage(null);

      const {
        data,
        error,
      } = await supabase
        .from("system_performance_batches")
        .select(
          "id, report_date, dataset_type, snapshot_type, version_no, status, is_current, row_count, source_method, source_file_name, source_sheet_name, created_at, deleted_at, delete_reason, restored_from_batch_id"
        )
        .eq("report_date", target.reportDate)
        .eq("dataset_type", target.datasetType)
        .eq("snapshot_type", target.snapshotType)
        .neq("status", "draft")
        .order("version_no", {
          ascending: false,
        });

      if (cancelled) {
        return;
      }

      if (error) {
        setVersions([]);
        setErrorMessage(
          error.message ||
            "전산실적 버전 이력을 불러오지 못했습니다."
        );
        setLoading(false);
        return;
      }

      setVersions(
        (data ?? []) as VersionRow[]
      );
      setLoading(false);
    };

    void loadVersions();

    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    target.datasetType,
    target.reportDate,
    target.snapshotType,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !restoringId) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    onClose,
    restoringId,
  ]);

  const restoreVersion = async (
    version: VersionRow
  ) => {
    if (target.locked) {
      setErrorMessage(
        "마감이 확정된 상태에서는 복원할 수 없습니다. 마감보고에서 [수정]을 눌러 수정 모드로 전환한 뒤 다시 시도해주세요."
      );
      return;
    }

    if (
      version.status === "applied" &&
      version.is_current
    ) {
      return;
    }

    const confirmed = window.confirm(
      `${target.datasetTitle} · ${target.snapshotTitle}의 v${version.version_no} 자료를 현재 버전으로 복원할까요?\n\n복원해도 기존 이력은 삭제되지 않으며, 새로운 버전으로 기록됩니다.`
    );

    if (!confirmed) {
      return;
    }

    setRestoringId(version.id);
    setErrorMessage(null);

    try {
      const {
        error,
      } = await supabase.rpc(
        "restore_system_performance_batch",
        {
          p_source_batch_id: version.id,
          p_note: `버전 이력 v${version.version_no} 복원`,
        }
      );

      if (error) {
        throw error;
      }

      onRestored(
        `${target.datasetTitle} · ${target.snapshotTitle}의 v${version.version_no} 자료를 새로운 현재 버전으로 복원했습니다.`
      );
    }
    catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "버전 복원 중 오류가 발생했습니다.";

      setErrorMessage(message);
    }
    finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[24px] border border-[#E2E4E7] bg-white shadow-[0_24px_80px_rgba(20,24,31,0.22)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#ECEEF1] px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F4F5F6] text-[#555B63]">
                <History size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] text-[#A50034]">
                  VERSION HISTORY
                </p>

                <h2 className="mt-1 truncate text-[20px] font-bold tracking-[-0.035em] text-[#25282D]">
                  {target.datasetTitle} · {target.snapshotTitle} 이력
                </h2>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-[#7D828A]">
              이전 적용본과 삭제 이력을 확인할 수 있습니다. 과거 버전을 복원하면 기존 이력은 그대로 보존되고 새로운 버전이 생성됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(restoringId)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E3E5E8] text-[#6E737B] transition hover:bg-[#F5F6F7] disabled:opacity-40"
            aria-label="닫기"
          >
            <X size={17} />
          </button>
        </header>

        {target.locked && (
          <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-[13px] border border-[#E5E7EA] bg-[#F6F7F8] px-4 py-3 sm:mx-6">
            <ShieldCheck
              size={16}
              className="mt-0.5 shrink-0 text-[#6C727B]"
            />

            <p className="text-[11px] leading-5 text-[#646A72]">
              현재 날짜는 마감 잠금 상태입니다. 이력 조회는 가능하지만 복원하려면 마감보고에서 <strong className="text-[#A50034]">[수정]</strong>을 눌러 수정 모드로 전환해야 합니다.
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="mx-5 mt-4 rounded-[13px] border border-[#F0D7DC] bg-[#FFF7F8] px-4 py-3 text-[11px] font-medium leading-5 text-[#9A4053] sm:mx-6">
            {errorMessage}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-[#767B83]">
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
                버전 이력을 불러오는 중입니다.
              </div>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#DDE0E4] bg-[#FAFAFB] px-5 text-center">
              <History
                size={28}
                className="text-[#A8ADB4]"
              />

              <p className="mt-3 text-[13px] font-bold text-[#565B63]">
                아직 저장된 버전 이력이 없습니다.
              </p>

              <p className="mt-1 text-[11px] leading-5 text-[#8A8F97]">
                전산실적을 적용하거나 현재 자료를 삭제하면 이력이 이곳에 남습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => {
                const statusInfo = getStatusInfo(version);
                const StatusIcon = statusInfo.Icon;
                const isCurrent =
                  version.status === "applied" &&
                  version.is_current;
                const restoring = restoringId === version.id;

                return (
                  <article
                    key={version.id}
                    className={[
                      "rounded-[17px] border p-4 sm:p-5",
                      isCurrent
                        ? "border-[#CCE4D6] bg-[#F8FCF9]"
                        : "border-[#E5E7EA] bg-[#FAFAFB]",
                    ].join(" ")}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[18px] font-bold tabular-nums text-[#2D3035]">
                            v{version.version_no}
                          </p>

                          <span
                            className={[
                              "inline-flex min-h-[28px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold",
                              statusInfo.className,
                            ].join(" ")}
                          >
                            <StatusIcon size={12} />
                            {statusInfo.label}
                          </span>

                          {version.restored_from_batch_id && (
                            <span className="rounded-full bg-[#F3F0FA] px-2.5 py-1 text-[10px] font-bold text-[#6F5A97]">
                              복원 생성본
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                          <div>
                            <p className="text-[9px] font-semibold text-[#9B9FA6]">행 수</p>
                            <p className="mt-1 text-[12px] font-bold tabular-nums text-[#555A62]">
                              {(version.row_count ?? 0).toLocaleString("ko-KR")}건
                            </p>
                          </div>

                          <div>
                            <p className="text-[9px] font-semibold text-[#9B9FA6]">입력 방식</p>
                            <p className="mt-1 text-[12px] font-semibold text-[#555A62]">
                              {getSourceLabel(version.source_method)}
                            </p>
                          </div>

                          <div className="col-span-2">
                            <p className="text-[9px] font-semibold text-[#9B9FA6]">생성 시각</p>
                            <p className="mt-1 text-[12px] font-semibold text-[#555A62]">
                              {formatCreatedAt(version.created_at)}
                            </p>
                          </div>
                        </div>

                        {version.source_file_name && (
                          <div className="mt-4 flex min-w-0 items-start gap-2 rounded-[10px] bg-white px-3 py-2.5">
                            <FileSpreadsheet
                              size={14}
                              className="mt-0.5 shrink-0 text-[#8A8F97]"
                            />

                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-[#5E636B]">
                                {version.source_file_name}
                              </p>

                              {version.source_sheet_name && (
                                <p className="mt-0.5 truncate text-[10px] text-[#9A9EA5]">
                                  {version.source_sheet_name}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {version.status === "deleted" && version.delete_reason && (
                          <p className="mt-3 text-[10px] leading-4 text-[#9A5867]">
                            삭제 사유: {version.delete_reason}
                            {version.deleted_at
                              ? ` · ${formatCreatedAt(version.deleted_at)}`
                              : ""}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 sm:pt-1">
                        {isCurrent ? (
                          <div className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[#EAF6EE] px-3 text-[10px] font-bold text-[#287348]">
                            현재 사용 중
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void restoreVersion(version)}
                            disabled={target.locked || Boolean(restoringId)}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[#A50034] px-3 text-[10px] font-bold text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {restoring ? (
                              <LoaderCircle
                                size={13}
                                className="animate-spin"
                              />
                            ) : (
                              <RotateCcw size={13} />
                            )}
                            이 버전 복원
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-[#ECEEF1] bg-[#FAFAFB] px-5 py-3.5 sm:px-6">
          <p className="text-[10px] leading-4 text-[#8A8F97]">
            과거 버전은 마감 감사와 복원을 위해 일반 사용자 화면에서 물리적으로 삭제하지 않습니다. 현재 자료의 [삭제]는 소프트 삭제로 처리되어 이력이 보존됩니다.
          </p>
        </footer>
      </div>
    </div>
  );
}
