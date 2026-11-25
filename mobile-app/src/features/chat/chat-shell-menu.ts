import {
  Globe,
  User,
  Users,
  Radio,
  Briefcase,
  LineChart,
  Layout,
  PenSquare,
  MessageSquare,
  Menu,
  Bookmark,
  Archive,
  ClipboardList,
  type LucideIcon,
} from "lucide-react-native";

export type HeaderActionId = "expert_tools" | "compose";

/** PenSquare menyusi: kontakt / guruh / kanal (tanlash — "Tahrirlash" tugmasida) */
export type ComposeActionId = "new_contact" | "new_group" | "new_channel" | "bulk_select";

export const COMPOSE_MENU_ITEMS: {
  id: ComposeActionId;
  titleKey: "menuNewContact" | "menuNewGroup" | "menuNewChannel" | "menuSelect";
  visible?: (ctx: { isExpert: boolean }) => boolean;
}[] = [
  { id: "new_contact", titleKey: "menuNewContact" },
  { id: "new_group", titleKey: "menuNewGroup", visible: ({ isExpert }) => !isExpert },
  { id: "new_channel", titleKey: "menuNewChannel" },
];

export function getVisibleComposeMenuItems(ctx: { isExpert: boolean }) {
  return COMPOSE_MENU_ITEMS.filter((item) => (item.visible ? item.visible(ctx) : true));
}

export const MENU_ICONS = {
  Globe,
  User,
  Users,
  Radio,
  Briefcase,
  LineChart,
  Layout,
  PenSquare,
  MessageSquare,
  Menu,
  Bookmark,
  Archive,
  ClipboardList,
} satisfies Record<string, LucideIcon>;

export type MenuIconName = keyof typeof MENU_ICONS;

export function getMenuIcon(name: MenuIconName): LucideIcon {
  return MENU_ICONS[name];
}

/** Chat filtrlari — web CHAT_FOLDERS bilan mos (moliya drawerda) */
export const CHAT_CATEGORY_ITEMS: {
  id: string;
  label: string;
  icon: MenuIconName;
}[] = [
  { id: "all", label: "Hammasi", icon: "Globe" },
  { id: "user", label: "Shaxsiy", icon: "User" },
  { id: "group", label: "Guruh", icon: "Users" },
  { id: "channel", label: "Kanal", icon: "Radio" },
  { id: "listings", label: "E'lonlar", icon: "ClipboardList" },
  { id: "archive", label: "Arxiv", icon: "Archive" },
];

export const HEADER_RIGHT_ACTIONS: {
  id: HeaderActionId;
  icon: MenuIconName;
  accessibilityLabel: string;
  visible: (ctx: { isExpert: boolean }) => boolean;
}[] = [
  {
    id: "expert_tools",
    icon: "Layout",
    accessibilityLabel: "Ekspert paneli",
    visible: () => false,
  },
  {
    id: "compose",
    icon: "PenSquare",
    accessibilityLabel: "Yangi xabar",
    visible: () => true,
  },
];

