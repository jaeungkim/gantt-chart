import { ROUTE_PATH } from './routePath';

export interface MenuConfig {
  path: string;
  label: string;
  subMenu?: Record<string, MenuConfig>;
}

export const MENU_CONFIG: Record<string, MenuConfig> = {
  dashboard: {
    path: ROUTE_PATH.dashboard,
    label: 'dashboard',
  },
  drawingManagement: {
    path: ROUTE_PATH.drawingManagement,
    label: 'drawingManagement',
    subMenu: {
      designDrawingManagement: {
        path: ROUTE_PATH.designDrawingManagement,
        label: 'designDrawingManagement',
      },
      bimManagement: {
        path: ROUTE_PATH.bimManagement,
        label: 'bimManagement',
      },
      drawingBimViewer: {
        path: ROUTE_PATH.drawingBimViewer,
        label: 'drawingBimViewer',
      },
      drawingBimApprovalManagement: {
        path: ROUTE_PATH.drawingBimApprovalManagement,
        label: 'drawingBimApprovalManagement',
      },
    },
  },
  processManagement: {
    path: ROUTE_PATH.processManagement,
    label: 'processManagement',
    subMenu: {
      workClassificationSystem: {
        path: ROUTE_PATH.workClassificationSystem,
        label: 'workClassificationSystem',
      },
      wbs: {
        path: ROUTE_PATH.wbs,
        label: 'wbs',
      },
      sCurve: {
        path: ROUTE_PATH.sCurve,
        label: 'sCurve',
      },
      processPerformanceRegistration: {
        path: ROUTE_PATH.processPerformanceRegistration,
        label: 'processPerformanceRegistration',
      },
      weeklyWorkReport: {
        path: ROUTE_PATH.weeklyWorkReport,
        label: 'weeklyWorkReport',
      },
      monthlyWorkReport: {
        path: ROUTE_PATH.monthlyWorkReport,
        label: 'monthlyWorkReport',
      },
    },
  },
  constructionManagement: {
    path: ROUTE_PATH.constructionManagement,
    label: 'constructionManagement',
    subMenu: {
      workPlanRegistration: {
        path: ROUTE_PATH.workPlanRegistration,
        label: 'workPlanRegistration',
      },
      weatherTable: {
        path: ROUTE_PATH.weatherTable,
        label: 'weatherTable',
      },
      dailyWorkReport: {
        path: ROUTE_PATH.dailyWorkReport,
        label: 'dailyWorkReport',
      },
    },
  },
};

export const SETTING_MENU_CONFIG: Record<string, MenuConfig> = {
  admin: {
    path: ROUTE_PATH.admin,
    label: '관리자메뉴',
    // FIXME: 사용자 관리 이외 다른 메뉴가 추가되면 주석 해제
    // subMenu: {
    //   userManagement: {
    //     path: ROUTE_PATH.userManagement,
    //     label: '사용자 관리',
    //   },
    // },
  },
  personal: {
    path: ROUTE_PATH.personalSettings,
    label: '개인설정',
  },
};
