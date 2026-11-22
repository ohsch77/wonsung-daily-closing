/**
 * 운영 화면의 지연 구간을 식별하기 위한 서버 전용 측정 도구입니다.
 * WONSUNG_PERF_DIAGNOSTICS=1 인 환경에서만 시간을 기록합니다.
 * 결과·오류·권한·쿼리 내용은 변경하지 않으며 사용자 식별정보도 기록하지 않습니다.
 */
export async function measureServerPerformance<T>(
  label: string,
  work: () => T | PromiseLike<T>
): Promise<Awaited<T>> {
  if (process.env.WONSUNG_PERF_DIAGNOSTICS !== "1") {
    return await work();
  }

  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    const elapsedMs = performance.now() - startedAt;
    console.info(`[WONSUNG PERF] ${label}: ${elapsedMs.toFixed(1)}ms`);
  }
}
