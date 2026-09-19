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
  completedReportCount: number;
  metricValueCount: number;
  generatedAt: string;
};
