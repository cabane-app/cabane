// A standalone welcome visit can check its destination without importing the
// project codec, catalog, or renderer, or deserializing any personal homes.
import {
  PROJECT_STORE,
  STATE_STORE,
  WORKSPACE_STORE,
  projectTransaction,
} from "./home-project/project-database";
import {
  WORKSPACE_ONBOARDING_KEY,
  parseWorkspaceOnboarding,
} from "./home-project/workspace-onboarding-state";
import "./styles/tokens.css";
import "./styles/base.css";
import "./onboarding/onboarding.css";
import "./onboarding/welcome.css";

export { OnboardingIntroduction } from "./onboarding/OnboardingIntroduction";

export function mobileWelcomeEligibility(factory: IDBFactory) {
  return projectTransaction<"fresh" | "demo" | "other">(
    factory,
    "readonly",
    [PROJECT_STORE, STATE_STORE, WORKSPACE_STORE],
    (tx, request, done) => {
      const state = tx.objectStore(STATE_STORE);
      request(state.get("initialized"), (initialized) => {
        if (!initialized) {
          // Older installations can have project records before workspace metadata exists.
          request(tx.objectStore(PROJECT_STORE).count(), (count) =>
            done(count === 0 ? "fresh" : "other"),
          );
          return;
        }
        request(state.get(WORKSPACE_ONBOARDING_KEY), (value) => {
          const progress = parseWorkspaceOnboarding(value);
          if (!progress?.demoWorkspaceId) return done("other");
          const workspaces = tx.objectStore(WORKSPACE_STORE);
          const build = progress.destinations.build;
          request(workspaces.getKey(progress.demoWorkspaceId), (demo) => {
            if (!demo) return done("other");
            // The full introduction offers recovery if its saved Build destination was deleted.
            if (build) request(workspaces.getKey(build), (key) => done(key ? "demo" : "other"));
            else done("demo");
          });
        });
      });
    },
  );
}
