import { useEffect, useRef, useState } from "react";
import { useCabaneDom } from "../../CabaneDom";
import type { RuntimeBindingProfileManager } from "../../RuntimeBindingSetup";
import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "../../types";
import { OnboardingIntroduction, type OnboardingLinks } from "../OnboardingIntroduction";
import { WelcomeDemoInvitation } from "../WelcomeDemoInvitation";
import { WelcomeScene } from "./WelcomeScene";
import { useWelcomePreview } from "./useWelcomePreview";

export function WelcomeExperience({
  manifest,
  architectureModels,
  deviceModels,
  manager,
  links,
  busy,
  error,
  onExplore,
  onBuild,
}: {
  manifest: HomeManifest;
  architectureModels: ArchitectureModelRegistry;
  deviceModels: DeviceModelRegistry;
  manager: RuntimeBindingProfileManager;
  links?: OnboardingLinks | undefined;
  busy: boolean;
  error: string | null;
  onExplore: () => void;
  onBuild: () => void;
}) {
  const preview = useWelcomePreview(manifest);
  const { root } = useCabaneDom();
  const [invited, setInvited] = useState(false);
  const invitation = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = invitation.current;
    if (invited && panel && getComputedStyle(panel).gridRowStart === "invitation") {
      panel.scrollIntoView({
        block: "nearest",
        behavior: preview.reducedMotion ? "instant" : "smooth",
      });
    }
  }, [invited, preview.reducedMotion]);

  const dismissInvitation = () => {
    if (invitation.current?.contains(root.activeElement)) {
      stage.current?.querySelector("canvas")?.focus({ preventScroll: true });
    }
    setInvited(false);
  };

  return (
    <div
      className="cabane-app setup-shell onboarding-shell--open"
      onKeyDown={(event) => {
        if (invited && event.key === "Escape") {
          event.stopPropagation();
          dismissInvitation();
        }
      }}
    >
      <div ref={stage} className="setup-shell__scene">
        <WelcomeScene
          manifest={manifest}
          architectureModels={architectureModels}
          deviceModels={deviceModels}
          manager={manager}
          preview={preview}
          onInvite={() => setInvited(true)}
        />
      </div>
      {invited && (
        <WelcomeDemoInvitation
          busy={busy}
          onExplore={onExplore}
          onDismiss={dismissInvitation}
          panelRef={invitation}
        />
      )}
      <OnboardingIntroduction
        preview={preview}
        links={links}
        busy={busy}
        error={error}
        onExplore={onExplore}
        onBuild={onBuild}
        onDismiss={onExplore}
      />
    </div>
  );
}
