export interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  dependencies: string[];
  assignee: string;
  status: string;
  priority: string;
  description: string;
  parentId: string | null;
}