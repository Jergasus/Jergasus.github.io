import type { ComponentType } from 'react';
import type { AppId } from '../apps';
import type { IconProps } from './palette';
import { AboutIcon } from './AboutIcon';
import { WelcomeIcon } from './WelcomeIcon';
import { ActivityIcon } from './ActivityIcon';
import { BrowserIcon } from './BrowserIcon';
import { BusinessIcon } from './BusinessIcon';
import { ContactIcon } from './ContactIcon';
import { ProjectsIcon } from './ProjectsIcon';
import { QuestDayIcon } from './QuestDayIcon';
import { RallyVoleyIcon } from './RallyVoleyIcon';
import { SakuraiIcon } from './SakuraiIcon';
import { SettingsIcon } from './SettingsIcon';
import { SystemIcon } from './SystemIcon';
import { TerminalIcon } from './TerminalIcon';
import { YokaidoIcon } from './YokaidoIcon';

/**
 * One icon per app, drawn in the JG-OS style: 40 × 40, black 2.5 outline, flat
 * fills, transparent ground (the app-coloured tile behind it is CSS). Every
 * icon is aria-hidden: the text chip beside it is the label.
 */
export const APP_ICONS: Record<AppId, ComponentType<IconProps>> = {
  welcome: WelcomeIcon,
  about: AboutIcon,
  projects: ProjectsIcon,
  activity: ActivityIcon,
  business: BusinessIcon,
  contact: ContactIcon,
  terminal: TerminalIcon,
  browser: BrowserIcon,
  system: SystemIcon,
  settings: SettingsIcon,
  yokaido: YokaidoIcon,
  questday: QuestDayIcon,
  sakurai: SakuraiIcon,
  'rally-voley': RallyVoleyIcon,
};

export { ICON_COLOURS, type IconProps } from './palette';
export { ChatIcon } from './ChatIcon';
export { ContactIcon as MailIcon } from './ContactIcon';
export { MissingFileIcon } from './MissingFileIcon';
export { JgOsLogo } from './JgOsLogo';
