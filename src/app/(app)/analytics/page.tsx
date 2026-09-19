import AnalyticsWorkspace from "@/components/analytics/AnalyticsWorkspace";

import {
  loadPerformanceAnalysisSnapshot,
} from "@/lib/analytics/server";

import type {
  PerformanceAnalysisSnapshot,
} from "@/lib/analytics/types";

export const dynamic =
  "force-dynamic";

function getKstToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Seoul",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "한국 날짜를 계산할 수 없습니다."
    );
  }

  return `${year}-${month}-${day}`;
}

export default async function AnalyticsPage() {
  const today =
    getKstToday();

  const startDate =
    `${today.slice(0, 7)}-01`;

  let initialSnapshot:
    PerformanceAnalysisSnapshot | null =
      null;

  let initialError = "";

  try {
    initialSnapshot =
      await loadPerformanceAnalysisSnapshot(
        startDate,
        today
      );
  } catch (error) {
    initialError =
      error instanceof Error
        ? error.message
        : "분석 데이터를 불러오지 못했습니다.";
  }

  return (
    <AnalyticsWorkspace
      initialSnapshot={
        initialSnapshot
      }
      initialError={
        initialError
      }
    />
  );
}
