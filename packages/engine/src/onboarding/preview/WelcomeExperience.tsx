import type { RuntimeBindingProfileManager } from "../../RuntimeBindingSetup";
import type { ArchitectureModelRegistry, DeviceModelRegistry, HomeManifest } from "../../types";
import { OnboardingIntroduction, type OnboardingLinks } from "../OnboardingIntroduction";
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
  return (
    <div className="cabane-app setup-shell onboarding-shell--open">
      <div className="setup-shell__scene">
        <WelcomeScene
          manifest={manifest}
          architectureModels={architectureModels}
          deviceModels={deviceModels}
          manager={manager}
          preview={preview}
        />
      </div>
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
