import type { GanttScaleKey, GanttTheme } from '@jaeungkim/gantt-chart';

// Every switch the playground offers; mirrored into the query string (`?scale=week&holidays=1`).
export interface Settings {
  hierarchy: boolean;
  showTaskList: boolean;
  showRowNumbers: boolean;
  readOnly: boolean;
  allowMove: boolean;
  allowResize: boolean;
  allowProgressChange: boolean;
  allowLinkCreate: boolean;
  allowLinkDelete: boolean;
  allowTaskCreate: boolean;
  reorder: boolean;
  selectable: boolean;
  vetoLinkCreate: boolean;
  vetoLinkDelete: boolean;
  vetoMove: boolean;
  scale: GanttScaleKey;
  zoomOnWheel: boolean;
  infiniteScroll: boolean;
  showNonWorkingDays: boolean;
  holidays: boolean;
  sixDayWeek: boolean;
  workingCalendar: boolean;
  autoScrollOnDrag: boolean;
  dateBounds: boolean;
  visibleRange: boolean;
  initialScrollTo: string;
  showDetail: boolean;
  customDetail: boolean;
  controlledDetail: boolean;
  // 'host' passes no `theme` prop at all, so the chart inherits the site's color-scheme.
  theme: GanttTheme | 'host';
  locale: string;
  firstDayOfWeek: string;
  showTooltip: boolean;
  customFormats: boolean;
  chartHeight: string;
}

type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];
type SelectKey = Exclude<keyof Settings, BooleanKey>;

// Anything a select can hold; narrowed by the row's own `options` list before it is stored.
export type SelectValue = GanttScaleKey & GanttTheme & string;

// The scale ladder, finest first. The package exports no constant for it, and two controls read
// it now: the console's own row and the toolbar select above the chart.
export const SCALES: readonly GanttScaleKey[] = ['day', 'week', 'month', 'quarter', 'year'];

type ControlGroup = 'Data' | 'Editing' | 'Timeline' | 'Presentation';

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
    key: 'showTaskList',
    label: 'Task list',
    hint: 'The pinned pane on the left',
    group: 'Data',
    type: 'boolean',
  },

  {
    key: 'showRowNumbers',
    label: 'Row numbers',
    hint: 'Prints each row’s sequence ("2.1") in front of the name',
    group: 'Data',
    type: 'boolean',
  },
  {
    key: 'showDetail',
    label: 'Detail panel',
    hint: 'Opens on a click; narrows the timeline, never covers it',
    group: 'Data',
    type: 'boolean',
  },
  {
    key: 'customDetail',
    label: 'Custom detail body',
    hint: '`renderDetail` replaces the built-in field list',
    group: 'Data',
    type: 'boolean',
  },
  {
    key: 'controlledDetail',
    label: 'Controlled detail',
    hint: '`detailTaskId` drives the panel; the chart only proposes through `onDetailChange`',
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
    hint: 'The task list’s Add task row, addTask(), drag below the last row',
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
    key: 'selectable',
    label: 'Selectable',
    hint: 'Off leaves `onTaskSelect` wired but never fires it',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'vetoLinkCreate',
    label: 'Reject new links',
    hint: '`onDependencyCreate` returns false - the arrow is drawn, then refused',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'vetoLinkDelete',
    label: 'Reject link deletes',
    hint: '`onDependencyDelete` returns false',
    group: 'Editing',
    type: 'boolean',
  },
  {
    key: 'vetoMove',
    label: 'Reject row moves',
    hint: '`onTaskMove` returns false - needs Row reorder on',
    group: 'Editing',
    type: 'boolean',
  },

  {
    key: 'scale',
    label: 'Scale',
    hint: 'The chart ships no picker - this select is the host’s',
    group: 'Timeline',
    type: 'select',
    options: SCALES,
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
    hint: 'Tinted days off in the demo range - two named, one bare date',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'sixDayWeek',
    label: 'Six-day week',
    hint: 'Work Saturdays - only Sunday is off',
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
    key: 'dateBounds',
    label: 'Drag bounds',
    hint: '`minDate`/`maxDate` clamped to the fixture span',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'visibleRange',
    label: 'Pinned range',
    hint: '`visibleStart`/`visibleEnd`, two weeks past the tasks either side',
    group: 'Timeline',
    type: 'boolean',
  },
  {
    key: 'initialScrollTo',
    label: 'Initial scroll',
    hint: 'Mount-time only, so the chart remounts on a change',
    group: 'Timeline',
    type: 'select',
    options: ['anchor', 'today', 'none'],
  },

  {
    key: 'theme',
    label: 'Theme',
    hint: '"host" inherits the site, "system" the OS',
    group: 'Presentation',
    type: 'select',
    options: ['host', 'system', 'light', 'dark'],
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
    key: 'customFormats',
    label: 'Label overrides',
    hint: '`formats` beats the locale on the day and week scales',
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
  'Presentation',
];

// Every feature on, so the page shows the whole chart before a single switch is touched. Two
// classes stay off: restrictions (`readOnly`, `dateBounds`, `visibleRange`, every `veto*`) and
// overrides (`customDetail`, `controlledDetail`, `customFormats`), each of
// which replaces a built-in behaviour rather than adding one - turning them on hides a feature.
export const DEFAULTS: Settings = {
  hierarchy: true,
  showTaskList: true,
  showRowNumbers: true,
  readOnly: false,
  allowMove: true,
  allowResize: true,
  allowProgressChange: true,
  allowLinkCreate: true,
  allowLinkDelete: true,
  allowTaskCreate: true,
  reorder: true,
  selectable: true,
  vetoLinkCreate: false,
  vetoLinkDelete: false,
  vetoMove: false,
  // The fixture runs seven weeks; only the month scale fits all of it on screen at once, which
  // is also what every <GanttDemo> on the site opens on.
  scale: 'month',
  zoomOnWheel: true,
  infiniteScroll: true,
  showNonWorkingDays: true,
  holidays: true,
  sixDayWeek: false,
  workingCalendar: true,
  autoScrollOnDrag: true,
  dateBounds: false,
  visibleRange: false,
  // Centred, and the fixture is built so today sits mid-project - the whole span lands on
  // screen at the month scale, which anchoring to the fixture's first day does not.
  initialScrollTo: 'today',
  showDetail: true,
  customDetail: false,
  controlledDetail: false,
  theme: 'host',
  locale: 'en-US',
  firstDayOfWeek: '1',
  showTooltip: true,
  customFormats: false,
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
