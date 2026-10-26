/** The range `onTaskCreate` receives from a draw below the last row, the Add task button or `addTask()`; the chart adds no task itself. See https://gantt.jaeungkim.com/docs/task-creation */
export interface GanttTaskDraft {
  /** Start of the first tick covered on the current scale, as a UTC ISO string; `minDate` is not applied. */
  startDate: string;
  /** End of the last tick covered, as a UTC ISO string; exclusive, so a one-tick draft ends where the next tick starts. `maxDate` is not applied. */
  endDate: string;
}
