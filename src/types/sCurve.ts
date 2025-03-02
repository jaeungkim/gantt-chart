export type sCurvePeriodType = '월별' | '분기별' | '연별';
export type sCurvePeriodTypeAPI = 'MONTH' | 'QUARTER' | 'YEAR';

export type MultiChartsDataType = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
};

export interface RequestGetChart {
  projectId: string;
  startDate: string;
  endDate: string;
  periodType: sCurvePeriodTypeAPI;
}

export type ResponseGetChart = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
};
