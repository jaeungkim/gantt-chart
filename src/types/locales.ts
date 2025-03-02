import { DisplayActivityStatusType } from './activity';
import { Weekday } from './date';

export type LanguageKey =
  | 'dashboard'
  | 'drawingManagement'
  | 'designDrawingManagement'
  | 'bimManagement'
  | 'drawingBimViewer'
  | 'drawingBimApprovalManagement'
  | 'processManagement'
  | 'workClassificationSystem'
  | 'wbs'
  | 'sCurve'
  | 'processPerformanceRegistration'
  | 'weeklyWorkReport'
  | 'monthlyWorkReport'
  | 'constructionManagement'
  | 'workPlanRegistration'
  | 'weatherTable'
  | 'dailyWorkReport'
  | 'admin'
  | 'userManagement'
  | 'year'
  | 'month'
  | 'week'
  | Weekday
  | 'today'
  | 'save'
  | 'cancel'
  | 'confirm'
  | 'delete'
  | 'connect'
  | DisplayActivityStatusType;
