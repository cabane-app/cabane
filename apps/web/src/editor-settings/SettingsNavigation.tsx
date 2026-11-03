import { useLayoutEffect, useRef } from "react";
import { EditorIcon } from "../editor-chrome/EditorIcon";
import { settingsSections, type SettingsSection } from "./settings-sections";

export function SettingsNavigation({
  section,
  onSelect,
  disabled,
}: {
  section: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  disabled: boolean;
}) {
  const navigation = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    navigation.current
      ?.querySelector<HTMLButtonElement>('[aria-current="page"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [section]);
  return (
    <nav ref={navigation} className="settings-navigation" aria-label="Settings sections">
      {settingsSections.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-current={entry.id === section ? "page" : undefined}
          disabled={disabled}
          onClick={() => onSelect(entry.id)}
        >
          <EditorIcon name={entry.icon} />
          <span>{entry.label}</span>
          <EditorIcon name="chevron" />
        </button>
      ))}
    </nav>
  );
}
