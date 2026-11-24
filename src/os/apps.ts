import { caseStudySlugs } from '@/content/projects';

export type AppId =
  | 'welcome'
  | 'about'
  | 'projects'
  | 'activity'
  | 'business'
  | 'contact'
  | 'terminal'
  | 'browser'
  | 'system'
  | 'settings'
  | 'yokaido'
  | 'questday'
  | 'sakurai'
  | 'rally-voley';

/** Subset of AppId that maps to a case-study route. Equals caseStudySlugs. */
export type CaseAppId = 'questday' | 'sakurai' | 'rally-voley';

export type AppColour = 'yellow' | 'pink' | 'green' | 'blue' | 'lilac' | 'peach' | 'mint' | 'sky' | 'cream' | 'grey';

/** Absolute pixel rect. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fractional rect — 0..1 of the desktop area. */
export interface FracRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppDef {
  id: AppId;
  /** Used as `os.apps.<messageKey>.title` / `.label` in messages files. */
  messageKey: string;
  colour: AppColour;
  route: 'case' | null;
  defaultRect: FracRect;
  minSize: { w: number; h: number };
  desktopIcon: boolean;
  phoneIcon: boolean;
  inStartMenu: boolean;
  /** True for terminal, browser and settings — no passive viewing mode. */
  interactiveOnly: boolean;
  /** True for welcome — centred on both axes, sized to content, until the window has a rect. */
  centred?: true;
}

// Shared defaults for all three case-study apps.
const CASE_RECT: FracRect = { x: 0.18, y: 0.04, w: 0.62, h: 0.86 };
const CASE_MIN = { w: 420, h: 320 };

export const apps: readonly AppDef[] = [
  {
    id: 'welcome',
    messageKey: 'welcome',
    colour: 'grey',
    route: null,
    defaultRect: { x: 0.3, y: 0.12, w: 0.42, h: 0.5 },
    minSize: { w: 360, h: 300 },
    desktopIcon: true,
    phoneIcon: false,
    inStartMenu: true,
    interactiveOnly: false,
    centred: true,
  },
  {
    id: 'about',
    messageKey: 'about',
    colour: 'lilac',
    route: null,
    defaultRect: { x: 0.12, y: 0.05, w: 0.34, h: 0.52 },
    minSize: { w: 300, h: 220 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'projects',
    messageKey: 'projects',
    colour: 'sky',
    route: null,
    defaultRect: { x: 0.54, y: 0.08, w: 0.4, h: 0.56 },
    minSize: { w: 320, h: 240 },
    desktopIcon: true,
    phoneIcon: false,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'activity',
    messageKey: 'activity',
    colour: 'mint',
    route: null,
    defaultRect: { x: 0.48, y: 0.3, w: 0.44, h: 0.5 },
    minSize: { w: 320, h: 260 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'business',
    messageKey: 'business',
    colour: 'peach',
    route: null,
    defaultRect: { x: 0.3, y: 0.1, w: 0.42, h: 0.66 },
    minSize: { w: 340, h: 360 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'contact',
    messageKey: 'contact',
    colour: 'cream',
    route: null,
    defaultRect: { x: 0.6, y: 0.5, w: 0.32, h: 0.38 },
    minSize: { w: 280, h: 200 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'terminal',
    messageKey: 'terminal',
    colour: 'cream',
    route: null,
    defaultRect: { x: 0.14, y: 0.44, w: 0.46, h: 0.46 },
    minSize: { w: 320, h: 200 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: true,
  },
  {
    id: 'browser',
    messageKey: 'browser',
    colour: 'sky',
    route: null,
    defaultRect: { x: 0.12, y: 0.04, w: 0.76, h: 0.88 },
    minSize: { w: 480, h: 360 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: true,
  },
  {
    id: 'system',
    messageKey: 'system',
    colour: 'lilac',
    route: null,
    defaultRect: { x: 0.36, y: 0.18, w: 0.34, h: 0.5 },
    minSize: { w: 300, h: 240 },
    desktopIcon: false,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'settings',
    messageKey: 'settings',
    colour: 'mint',
    route: null,
    defaultRect: { x: 0.38, y: 0.22, w: 0.3, h: 0.46 },
    minSize: { w: 280, h: 260 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: true,
  },
  {
    id: 'yokaido',
    messageKey: 'yokaido',
    colour: 'blue',
    route: null,
    defaultRect: { x: 0.56, y: 0.16, w: 0.3, h: 0.34 },
    minSize: { w: 260, h: 180 },
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  // Case-study apps — order matches caseStudySlugs (questday, sakurai, rally-voley)
  // and the colour spec: "four projects: yellow, pink, green and blue, in the spec's order"
  {
    id: 'questday',
    messageKey: 'questday',
    colour: 'yellow',
    route: 'case',
    defaultRect: CASE_RECT,
    minSize: CASE_MIN,
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'sakurai',
    messageKey: 'sakurai',
    colour: 'pink',
    route: 'case',
    defaultRect: CASE_RECT,
    minSize: CASE_MIN,
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
  {
    id: 'rally-voley',
    messageKey: 'rallyVoley',
    colour: 'green',
    route: 'case',
    defaultRect: CASE_RECT,
    minSize: CASE_MIN,
    desktopIcon: true,
    phoneIcon: true,
    inStartMenu: true,
    interactiveOnly: false,
  },
];

export function getApp(id: string): AppDef | undefined {
  return apps.find((a) => a.id === id);
}

export function isCaseApp(id: AppId): id is CaseAppId {
  return (caseStudySlugs as string[]).includes(id);
}

/** Top-to-bottom order of icons in the desktop icon column (one or two columns at smaller heights). */
export const DESKTOP_ICON_ORDER: readonly AppId[] = [
  'welcome',
  'about',
  'projects',
  'questday',
  'sakurai',
  'rally-voley',
  'yokaido',
  'activity',
  'business',
  'contact',
  'terminal',
  'browser',
  'settings',
];

/** Left-to-right, top-to-bottom order of icons in the phone home-screen grid. */
export const PHONE_ICON_ORDER: readonly AppId[] = [
  'questday',
  'sakurai',
  'rally-voley',
  'yokaido',
  'about',
  'activity',
  'business',
  'contact',
  'terminal',
  'browser',
  'system',
  'settings',
];
