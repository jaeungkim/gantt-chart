export type ResourceType = 'human' | 'material' | 'equipment';

export interface Resource {
  id: string;
  resourceName: string;
  specification: string;
  resourceUnit: string;
}

export interface InputResource {
  id: string;
  planning: number;
  performance: number;
}

export interface HumanInputResource extends InputResource {
  humanResource: {
    id: string;
    type: 'HumanResource';
    name: string;
    specification: string;
    resourceUnit: string;
  };
}

export interface MaterialInputResource extends InputResource {
  materialResource: {
    id: string;
    type: 'MaterialResource';
    name: string;
    specification: string;
    resourceUnit: string;
  };
}

export interface EquipmentInputResource extends InputResource {
  equipmentResource: {
    id: string;
    type: 'EquipmentResource';
    name: string;
    specification: string;
    resourceUnit: string;
  };
}

// =========================== API ===========================

/**
 * NOTE: 인력, 자재, 장비에서 공용으로 사용됩니다.
 */
export interface RequestGetResources {
  projectId: string;
  searchWord?: string;
  offset?: number;
  limit?: number;
}

/**
 * NOTE: 인력, 자재, 장비에서 공용으로 사용됩니다.
 */
export type ResponseGetResources = Resource[];

// ============= human (인력) =============
export interface RegisterHumanResourcePayload {
  activityId: string;
  plannedDate: string;
  humanResources: string[];
}

export interface RequestRegisterHumanResource {
  type: 'ActivityPlan';
  plannedDate: string;
  activityId: string;
  hasInputHumanResource: {
    planning: number;
    performance: number;
    humanResourceId: string;
  }[];
}

export interface ResponseRegisterHumanResource {
  id: string;
  plannedDate: string;
  activityId: string;
  hasInputMaterialResource: {
    planning: number;
    performance: number;
    materialResourceId: string;
  }[];
}

// ============= material (자재) =============
export interface RegisterMaterialResourcePayload {
  activityId: string;
  plannedDate: string;
  materialResources: string[];
}

export interface RequestRegisterMaterialResource {
  type: 'ActivityPlan';
  plannedDate: string;
  activityId: string;
  hasInputMaterialResource: {
    planning: number;
    performance: number;
    materialResourceId: string;
  }[];
}

export interface ResponseRegisterMaterialResource {
  id: string;
  plannedDate: string;
  activityId: string;
  hasInputMaterialResource: {
    planning: number;
    performance: number;
    materialResourceId: string;
  }[];
}

// ============= equipment (장비) =============
export interface RegisterEquipmentResourcePayload {
  activityId: string;
  plannedDate: string;
  equipmentResources: string[];
}

export interface RequestRegisterEquipmentResource {
  type: 'ActivityPlan';
  plannedDate: string;
  activityId: string;
  hasInputEquipmentResource: {
    planning: number;
    performance: number;
    equipmentResourceId: string;
  }[];
}

export interface ResponseRegisterEquipmentResource {
  id: string;
  plannedDate: string;
  activityId: string;
  hasInputEquipmentResource: {
    planning: number;
    performance: number;
    equipmentResourceId: string;
  }[];
}

// ============= activity별 투입자원 조회 =============
export type ResponseGetActivityInputResources =
  | {
      human: HumanInputResource[];
      material: MaterialInputResource[];
      equipment: EquipmentInputResource[];
    }
  | '';

// ============= activity별 투입자원 계획 / 실적 수정 =============
export interface RequestPatchInputResource {
  id: string; // inputResourceId,
  type: 'InputResource';
  resourceType: ResourceType;
  activityPlanId: string;
  planning?: number;
  performance?: number;
}

export interface RequestUnregisterInputResource {
  activityPlanId: string;
  resourceType: ResourceType;
  inputResourceId?: string; // 생략하는 경우 해당 resourceType의 모든 투입자원 삭제
}
