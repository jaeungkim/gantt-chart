// import { Activity } from 'types/activity';
import { truncateText } from 'utils/bar';

export const NODE_HEIGHT = 2.375;
export const INITIAL_HIERARCHY_WIDTH = 25;
export const MIN_HIERARCHY_WIDTH = 10;
export const MAX_HIERARCHY_WIDTH = 40;
export const SESSION_STORAGE_KEY = 'hierarchyWidth';
export const FIXED_PATH_LENGTH = 40;
export const TEXT_OFFSET_PER_INDEX = 40;

// export const staticKeys: { key: string; field: keyof Activity }[] = [
//   { key: 'ID', field: 'id' },
//   { key: '계획착수일', field: 'plannedStartDate' },
//   { key: '계획종료일', field: 'plannedEndDate' },
//   { key: '분류코드', field: 'code' },
//   { key: '분류명칭', field: 'classificationName' },
//   { key: '실적착수일', field: 'actualStartDate' },
//   { key: '실적종료일', field: 'actualEndDate' },
//   { key: '후행연결작업', field: 'activityDependencies' },
//   { key: '담당자', field: 'manager' },
//   { key: '담당자 번호', field: 'managerContact' },
//   { key: '특이사항', field: 'specialNotes' },
// ];

export const dependencyTypeConfig = {
  FS: {
    label: '마침 후 시작 (FS)',
    getDescription: (fromId: string, toId: string) => {
      const truncatedFromId = truncateText(fromId, 12);
      const truncatedToId = truncateText(toId, 12);

      return `Activity ${truncatedFromId} 는 Activity ${truncatedToId} 이 완료된 후에만 시작할 수 있습니다.`;
    },
    fromBoxClass: '',
    toBoxClass: 'ml-auto',
    startX: 160,
    startY: 19,
    finishX: 220,
    finishY: 58,
  },
  FF: {
    label: '마침 후 완료 (FF)',
    getDescription: (fromId: string, toId: string) => {
      const truncatedFromId = truncateText(fromId, 12);
      const truncatedToId = truncateText(toId, 12);

      return `Activity ${truncatedToId} 는 Activity ${truncatedFromId} 이 완료된 후에만 완료할 수 있습니다.`;
    },
    fromBoxClass: 'mx-auto',
    toBoxClass: 'mx-auto',
    startX: 270,
    startY: 19,
    finishX: 270,
    finishY: 58,
  },
  SS: {
    label: '시작 후 시작 (SS)',
    getDescription: (fromId: string, toId: string) => {
      const truncatedFromId = truncateText(fromId, 12);
      const truncatedToId = truncateText(toId, 12);

      return `Activity ${truncatedToId} 는 Activity ${truncatedFromId} 이 시작된 후에만 시작할 수 있습니다.`;
    },
    fromBoxClass: 'mx-auto',
    toBoxClass: 'mx-auto',
    startX: 110,
    startY: 19,
    finishX: 110,
    finishY: 58,
  },
  SF: {
    label: '시작 후 완료 (SF)',
    getDescription: (fromId: string, toId: string) => {
      const truncatedFromId = truncateText(fromId, 12);
      const truncatedToId = truncateText(toId, 12);

      return `Activity ${truncatedToId} 는 Activity ${truncatedFromId} 이 시작된 후에만 완료할 수 있습니다.`;
    },
    fromBoxClass: 'ml-16',
    toBoxClass: 'ml-auto mr-16',
    startX: 64,
    startY: 19,
    finishX: 316,
    finishY: 58,
  },
} as const;
