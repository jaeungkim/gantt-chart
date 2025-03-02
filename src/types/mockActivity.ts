export type ItemType = 'activity';

export interface ProjectsType {
  id: string;
  name: string;
}

export interface Activities {
  id: string;
  parentId?: string;
  rootId?: string;
  name: string;
  sequence: string;
  plannedStartDate: string;
  plannedEndDate: string;
  hasChildrenActivities?: boolean;
  // OPTIONAL FOR NOW NOT AVAILBALE FROM BE
  classificationCode?: string; // 분류코드
  classificationName?: string; // 분류명칭
  actualStartDate?: string; // 실적착수일
  actualEndDate?: string; // 실적종료일
  predecessorId?: string; // 선행연결작업
  successorId?: string; // 후행연결작업
  manager?: string; // 담당자
  managerContact?: string; // 담당자 번호
  specialNotes?: string; // 특이사항
}

export interface OpenActivities {
  [key: string]: boolean;
}

export interface ResponseGetProjects {
  id: string;
  name: string;
}

export interface ResponseGetRootActivities {
  id: string;
  name: string;
  sequence: string;
  plannedStartDate: string;
  plannedEndDate: string;
  hasChildrenActivities: boolean;
}

export interface ResponseGetChildActivities {
  id: string;
  name: string;
  sequence: string;
  plannedStartDate: string;
  plannedEndDate: string;
  hasChildrenActivities: boolean;
}

export interface RequestPatchActivitySequence {
  activityId: string;
  currentSequence: string;
  newSequence: string;
}

export interface RequestPatchActivity
  extends Partial<Omit<Activities, 'hasChildrenActivities'>> {
  id: string;
  parentId: string;
}
