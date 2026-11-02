export const settingsSections = [
  {
    id: "home-assistant",
    label: "Home Assistant",
    icon: "connect",
    description: "Connect your home and manage sync.",
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: "grid",
    description: "Customize the action bar on Home.",
  },
  {
    id: "backups",
    label: "Backups",
    icon: "export",
    description: "Export your workspace or restore a file.",
  },
  {
    id: "orbital-view",
    label: "Orbital view",
    icon: "cube",
    description: "Choose your home's appearance, overlays, lighting and weather.",
  },
  {
    id: "editor",
    label: "Editor",
    icon: "construct",
    description: "Choose the units used for measurements.",
  },
  {
    id: "explore",
    label: "Explore",
    icon: "walk",
    description: "Adjust first person look controls.",
  },
] as const;
export type SettingsSection = (typeof settingsSections)[number]["id"];
