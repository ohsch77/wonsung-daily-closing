export type AnalyticsManager = {
  id: string;
  employeeNo: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
};

export type AnalyticsCategory = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
};

export type AnalyticsMetric = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  unit: "amount" | "count" | "percent";
  effectSign: -1 | 1;
  aggregationType: "sum" | "average" | "rate";
  numeratorMetricId: string | null;
  denominatorMetricId: string | null;
  isActive: boolean;
  displayOrder: number;
};

export type AnalyticsDailyReport = {
  id: string;
  reportDate: string;
  managerId: string;
  status: string;
};

export type AnalyticsMetricValue = {
  reportId: string;
  metricId: string;
  value: number;
};

export type ReviewMetricDefinition = {
  metricId: string;
  code: string;
  name: string;
};

export type PerformanceMetricResolution = {
  storeSalesMetricId: string | null;
  externalSalesMetricId: string | null;
  salesCancelMetricId: string | null;
  subscriptionSalesMetricId: string | null;
  subscriptionCancelMetricId: string | null;
  kyowonSalesMetricId: string | null;
  kyowonCancelMetricId: string | null;
  consultationCountMetricId: string | null;
  consultationSalesMetricId: string | null;
  leadInMetricId: string | null;
  leadSuccessMetricId: string | null;
  reviewMetrics: ReviewMetricDefinition[];
  missingLabels: string[];
};

export type PerformanceAnalysisRow = {
  periodKey: string;
  reportDate: string | null;
  monthKey: string;
  managerId: string;
  managerName: string;
  employeeNo: string;

  totalSalesAmount: number;

  subscriptionSalesCount: number;
  subscriptionCancelCount: number;
  subscriptionNetCount: number;

  kyowonSalesCount: number;
  kyowonCancelCount: number;
  kyowonNetCount: number;

  consultationCount: number;
  consultationSalesCount: number;
  consultationSuccessRate: number | null;

  leadInCount: number;
  leadSuccessCount: number;
  leadSuccessRate: number | null;

  reviewValues: Record<string, number>;
  reviewTotal: number;
};

export type PerformanceAnalysisSnapshot = {
  startDate: string;
  endDate: string;
  managers: AnalyticsManager[];
  categories: AnalyticsCategory[];
  metrics: AnalyticsMetric[];
  resolution: PerformanceMetricResolution;
  dailyRows: PerformanceAnalysisRow[];
  monthlyRows: PerformanceAnalysisRow[];

  /**
   * Metric Builder 전용 읽기 데이터.
   * 기존 PerformanceAnalysisRow 구조를 변경하지 않기 위해 스냅샷에
   * periodKey → metricId → value 형태로 선택적으로 추가합니다.
   *
   * 기존 코드가 이 필드를 만들지 않아도 정상 동작하도록 optional입니다.
   */
  rawMetricValuesByPeriodKey?: Record<
    string,
    Record<string, number>
  >;

  completedReportCount: number;
  metricValueCount: number;
  generatedAt: string;
};
