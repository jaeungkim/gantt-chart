import type {
  GanttDetailTrigger,
  GanttScaleKey,
  GanttTheme,
} from '@jaeungkim/gantt-chart';

// Every switch the playground offers; mirrored into the query string (`?scale=week&holidays=1`).
export interface Settings {
  hierarchy: boolean;
  groupBy: boolean;
  showTaskList: boolean;
  readOnly: boolean;
  allowMove: boolean;
  allowResize: boolean;
  allowProgressChange: boolean;
  allowLinkCreate: boolean;
  allowLinkDelete: boolean;
  allowTaskCreate: boolean;
  reorder: boolean;
  scale: GanttScaleKey;
  zoomOnWheel: boolean;
  infiniteScroll: boolean;
  showNonWorkingDays: boolean;
  holidays: boolean;
  workingCalendar: boolean;
  autoScrollOnDrag: boolean;
  showDetail: boolean;
  detailTrigger: GanttDetailTrigger;
  theme: GanttTheme;
  locale: string;
  firstDayOfWeek: string;
  showTooltip: boolean;
  chartHeight: string;
}

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];
type SelectKey = Exclude<keyof Settings, BooleanKey>;

// Anything a select can hold; narrowed by the row's own `options` list before it is stored.
export type SelectValue = GanttScaleKey & GanttTheme & GanttDetailTrigger & string;

type ControlGroup = 'Data' | 'Editing' | 'Timeline' | 'Detail panel' | 'Presentation';

type Control =
  | { key: BooleanKey; label: string; hint: string; group: ControlGroup; type: 'boolean' }
  | {
      key: SelectKey;
      label: string;
      hint: string;
      group: ControlGroup;
      type: 'select';
      options: readonly string[];
    };

export const CONTROLS: readonly Control[] = [
  {
    key: 'hierarchy',
    label: 'Hierarchy',
    hint: 'Summary rows from the parentId chain',
    group: 'Data',
    type: 'boolean',
  },
  {
    key: 'groupBy',
    label: 'Swimlanes',
    hint: 'Group rows by progress status',
    group: 'Data',
    type: 'boolean',
  },
  {
    key: 'showTaskList',
    label: 'Task list',
    hint: 'The pinned pane on the left',
    group: 'Data',
    type: 'boolean',
  },

  {
    key: 'readOnly',
    label: 'Read only',
    hint: 'Freeze every gesture at once',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'allowMove',
    label: 'Move bars',
    hint: 'Off blocks dragging a bar outright',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'allowResize',
    label: 'Resize bars',
    hint: 'Off blocks dragging an edge outright',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'allowProgressChange',
    label: 'Drag progress',
    hint: 'Off blocks the progress handle outright',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'allowLinkCreate',
    label: 'Draw links',
    hint: 'Drag between bar endpoints',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'allowLinkDelete',
    label: 'Delete links',
    hint: 'Select an arrow, then Delete',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'allowTaskCreate',
    label: 'Create tasks',
    hint: 'Add task strip, addTask(), drag below the last row',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'reorder',
    label: 'Row reorder',
    hint: 'Grip, Alt+↑↓, Ctrl/Cmd+←→',
    group: 'Editing',
    type: 'boolean',
  },

  {
    key: 'scale',
    label: 'Scale',
    hint: 'The chart ships no picker - this select is the host’s',
    group: 'Timeline',
    type: 'select',
    options: ['day', 'week', 'month', 'quarter', 'year'],
  },
  {
    key: 'zoomOnWheel',
    label: 'Zoom on wheel',
    hint: 'Ctrl/Cmd + wheel steps the scale',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'infiniteScroll',
    label: 'Infinite scroll',
    hint: 'Grow the range at either end',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'showNonWorkingDays',
    label: 'Shade non-working days',
    hint: 'Weekends and holidays',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'holidays',
    label: 'Holidays',
    hint: 'Two fixed days inside the demo range',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'workingCalendar',
    label: 'Working calendar',
    hint: 'Snap drags forward off non-working days',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'autoScrollOnDrag',
    label: 'Auto-scroll on drag',
    hint: 'Reaching a viewport edge scrolls',
    group: 'Timeline',
    type: 'boolean',
  },

  {
    key: 'showDetail',
    label: 'Detail panel',
    hint: 'Narrows the timeline, never covers it',
    group: 'Detail panel',
    type: 'boolean',
  },
  {
    key: 'detailTrigger',
    label: 'Opens on',
    hint: '"none" leaves it to the ref',
    group: 'Detail panel',
    type: 'select',
    options: ['selection', 'doubleClick', 'none'],
  },

  {
    key: 'theme',
    label: 'Theme',
    hint: 'Chart only - "system" follows the site',
    group: 'Presentation',
    type: 'select',
    options: ['system', 'light', 'dark'],
  },
  {
    key: 'locale',
    label: 'Locale',
    hint: 'Every date label, through Intl',
    group: 'Presentation',
    type: 'select',
    options: ['en-US', 'ko-KR'],
  },
  {
    key: 'firstDayOfWeek',
    label: 'Week starts',
    hint: '0 Sunday, 1 Monday, 6 Saturday',
    group: 'Presentation',
    type: 'select',
    options: ['0', '1', '6'],
  },
  {
    key: 'showTooltip',
    label: 'Tooltips',
    hint: 'Hover and drag alike',
    group: 'Presentation',
    type: 'boolean',
  },
  {
    key: 'chartHeight',
    label: 'Chart height',
    hint: 'A short container is where overflow bugs show',
    group: 'Presentation',
    type: 'select',
    options: ['fill', '640', '420'],
  },
];

export const GROUPS: readonly ControlGroup[] = [
  'Data',
  'Editing',
  'Timeline',
  'Detail panel',
  'Presentation',
];

export const DEFAULTS: Settings = {
  hierarchy: true,
  groupBy: false,
  showTaskList: true,
  readOnly: false,
  allowMove: true,
  allowResize: true,
  allowProgressChange: true,
  allowLinkCreate: true,
  allowLinkDelete: true,
  allowTaskCreate: true,
  reorder: false,
  scale: 'week',
  zoomOnWheel: true,
  infiniteScroll: true,
  showNonWorkingDays: true,
  holidays: false,
  workingCalendar: false,
  autoScrollOnDrag: true,
  showDetail: false,
  detailTrigger: 'selection',
  theme: 'system',
  locale: 'en-US',
  firstDayOfWeek: '1',
  showTooltip: true,
  chartHeight: 'fill',
};

// Query-string settings over DEFAULTS. Reads `window` - never call on the server.
export function readSettings(): Settings {
  const params = new URLSearchParams(window.location.search);
  const next = { ...DEFAULTS };

  for (const control of CONTROLS) {
    const raw = params.get(control.key);
    if (raw === null) continue;

    if (control.type === 'boolean') {
      next[control.key] = raw !== '0' && raw !== 'false';
    } else if (control.options.includes(raw)) {
      next[control.key] = raw as SelectValue;
    }
  }

  return next;
}

// Mirror the non-default settings back into the URL, so the current view is linkable.
export function writeSettings(settings: Settings): void {
  const params = new URLSearchParams(window.location.search);

  for (const control of CONTROLS) {
    const value = settings[control.key];
    if (value === DEFAULTS[control.key]) {
      params.delete(control.key);
      continue;
    }
    // Several rows default to on, so a non-default value can be `false`.
    params.set(control.key, typeof value === 'boolean' ? (value ? '1' : '0') : value);
  }

  const query = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
  );
}
