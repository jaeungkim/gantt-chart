import { FileType } from './file';
import { dependencyType, NodeDependencyConnection } from './gantt';
import { User } from './user';

// drag and drop을 위한 ItemTypes
export type ItemType = 'activity';

export interface ProjectsType {
  id: string;
  name: string;
}

export type ActivityStatusType = 'NOT_INITIATED' | 'INITIATED' | 'COMPLETED';

export type DisplayActivityStatusType =
  | ActivityStatusType
  | 'INITIATED_DELAYED'
  | 'COMPLETED_DELAYED'
  | 'IN_PROGRESS';

export interface activityDependencies {
  dependencyType: dependencyType;
  activityId: string;
  name: string;
}

export interface ActivityType {
  id: string;
  code: string;
  name: string;
}
export interface Activity {
  id: string;
  rootName: string;
  name: string;
  sequence: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  progress: number;
  status: ActivityStatusType;
  activityDependencies: activityDependencies[];
  dependsOnActivityDependencies: activityDependencies[];
  users: User[];
  files: FileType[];
  hasChildrenActivities: boolean;
  code: string | null; // 분류코드 추가
  type: string; // 분류타입 추가
  referenceIds: string[]; // 참조 ID
  // FIXME: 임시 undefined 처리 추후 수정
  specialNotes?: string; // 특이사항
  activityPlanId?: string; // 계획 ID
  // OPTIONAL FOR NOW NOT AVAILBALE FROM BE
  classificationName?: string; // 분류명칭
  manager?: string; // 담당자
  managerContact?: string; // 담당자 번호
  managerIds?: string[];
  displayType?: string;
}

export interface ActivityHierarchy extends Activity {
  depth?: number;
  isHidden?: boolean;
  rootId: string;
  parentId: string;
  activities: Activity[];
  originalOrder: number;
  order: number;
  plannedBarLeftMargin: number;
  plannedBarWidth: number;
  actualBarLeftMargin: number;
  actualBarWidth: number;
  connections?: NodeDependencyConnection[];
}

export interface ActivityWithParentId extends Activity {
  parentId: string;
  // phoneNumber?: string;
}

export type ActivityTreeProps = Record<string, ActivityHierarchy>;

export interface OpenActivities {
  [key: string]: boolean;
}

export interface ActivityItemStyle {
  id: string | null;
  borderBottom: string;
}

// api
export interface ResponseGetProjects {
  id: string;
  name: string;
}

export interface RequestGetRootActivities {
  projectId: string;
}

type ActivityNodeType = 'LEAF' | 'ROOT';

export interface RequestGetActivities {
  projectId: string;
  name?: string; // like 검색
  code?: string; // 분류코드 like 검색
  date?: string;
  endDate?: string;
  offset?: number;
  limit?: number;
  type?: ActivityNodeType; // ROOT: 상위 항목만 조회, LEAF: 하위 항목만 조회, undefined: 전체 조회
  reportType?: 'daily' | 'weekly' | 'monthly'; // 일일, 주간, 월간
}

export type ResponseGetActivities = Activity[];
export type ResponseGetRootActivities = Activity;
export type ResponseGetChildActivities = Activity;

export interface RequestPatchActivitySequence {
  currentActivityId: string;
  currentSequence: string;
  newParentActivityId: string;
  newSequence: string;
}

export interface UpdateSequenceVariables {
  payload: RequestPatchActivitySequence;
  currentParentId: string;
  projectIdName: string;
}

export interface RequestPatchActivity
  extends Pick<
    Activity,
    | 'id'
    | 'name'
    | 'sequence'
    | 'plannedStartDate'
    | 'plannedEndDate'
    | 'status'
  > {
  parentId: string;
  dependencyType: dependencyType;
  linkActivityId: string;
  managerIds: string[];
  fileUfIds: string[];
  users: User[];
}

export interface ResponsePatchActivity {
  provider: string;
  entity: {
    id: string;
    type: string;
    name: {
      type: 'Property';
      value: string;
    };
    sequence: {
      type: 'Property';
      value: number;
    };
    plannedStartDate: {
      type: 'Property';
      value: string;
    };
    plannedEndDate: {
      type: 'Property';
      value: string;
    };
    managedBy: {
      type: 'Relationship';
      object: string;
    };
    '@context': string;
  };
}

export interface RequestUnregisterActivityManager {
  activityId: string;
  managerIds: string; // ',' 기준으로 다중 삭제 가능
}

export interface RequestUnregisterActivityFile {
  activityId: string;
  fileId: string;
}

export interface CheckedState {
  [key: string]: boolean;
}
export interface SequenceItem {
  id: string;
  sequence: string;
  order: number;
}

export type sequenceMapWithOrder = Record<string, SequenceItem>;

// delete activity dependency
export interface RequestDeleteActivityDependency {
  activityId: string;
  dependencyType: string;
  targetActivityId: string;
}
export interface RequestDeleteActivities {
  activityIds: string[];
}

export interface formFieldsType {
  value: string;
  setValue: (value: string) => void;
  label: string;
  fieldType: string;
  tag: keyof ActivityWithParentId;
  placeholder?: string;
  disabled?: boolean;
  isDateField?: boolean;
}

export interface RequestPostActivity
  extends Pick<
    Activity,
    | 'id'
    | 'name'
    | 'sequence'
    | 'progress'
    | 'status'
    | 'plannedStartDate'
    | 'plannedEndDate'
    | 'actualStartDate'
    | 'actualEndDate'
  > {
  parentId: string;
  managerIds: string[];
  fileUfIds: string[];
  dependencyType: string;
  linkActivityId: string;
}

export interface ResponsePostActivity {
  entity: {
    id: string;
    type: string;
    name: {
      type: 'Property';
      value: string;
    };
    sequence: {
      type: 'Property';
      value: number;
    };
    '@context': string;
  };
  provider: string;
}

export interface ResponseGetType {
  id: string;
  code: string;
  name: string;
}
export interface RequestCheckPerformanceAtActivityPlan {
  activityId: string;
  plannedDate: string;
}

export type ResponseCheckPerformanceAtActivityPlan = string[];

export interface RequestGetProcessedActivities {
  projectId: string;
  date: string;
  reportType: 'daily' | 'weekly' | 'monthly';
}

export type ResponseGetProcessedActivities = Activity[];
