import { CONNECT_RETURN_KEY } from "./editor-connect/editor-return-key";
import { startTransition, useState } from "react";
import {
  redirect,
  redirectDocument,
  replace,
  useActionData,
  useNavigate,
  useNavigation,
  useSubmit,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { mobileWelcomeEligibility, OnboardingIntroduction } from "@cabane/engine/welcome";
import { onboardingLinks } from "./onboarding-config";
import { isOAuthUrl } from "./public-site-analytics";
import posterImage from "./welcome-demo.webp";
import "./mobile-welcome.css";

type TourModule = typeof import("./HostedWorkspace");

let preloadRecovery: Promise<unknown> | undefined;

async function loadTour() {
  const failed = new Set<string>();
  const rememberFailure = ({ target }: Event) => {
    if (
      target instanceof HTMLLinkElement &&
      (target.rel === "modulepreload" || target.rel === "stylesheet") &&
      new URL(target.href).origin === window.location.origin
    )
      failed.add(target.href);
  };
  window.addEventListener("error", rememberFailure, true);
  try {
    return await import("./HostedWorkspace");
  } catch (cause) {
    // WebKit can reuse a failed preload across document navigations. Refresh
    // only the failed responses, once, while the visitor still has the poster.
    preloadRecovery = Promise.allSettled(
      Array.from(failed, async (url) => {
        const response = await fetch(url, { cache: "reload", signal: AbortSignal.timeout(2000) });
        if (response.ok) await response.arrayBuffer();
      }),
    );
    throw cause;
  } finally {
    window.removeEventListener("error", rememberFailure, true);
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  try {
    // The workspace router owns sign-in, legacy migration and returning-home routing.
    if (
      isOAuthUrl(url) ||
      isOAuthUrl(new URL(window.location.href)) ||
      window.sessionStorage.getItem(CONNECT_RETURN_KEY)
    )
      return false;
    const hasStoredPreferences = window.localStorage.length > 0;
    if (url.pathname === "/" && hasStoredPreferences) return false;
    const eligibility = await mobileWelcomeEligibility(window.indexedDB);
    const fresh = eligibility === "fresh" && !hasStoredPreferences;
    if (url.pathname === "/" && fresh) return replace("/welcome");
    return url.pathname === "/welcome" && (fresh || eligibility === "demo");
  } catch {
    // Let the normal workspace flow provide its storage recovery UI.
    return false;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // A browser caches a rejected module import for the lifetime of the document.
  const recoveryDestination = (await request.formData()).get("recover");
  if (recoveryDestination) {
    await preloadRecovery;
    if (request.signal.aborted) return null;
    if (recoveryDestination === "/build" || recoveryDestination === "/welcome")
      return redirectDocument(recoveryDestination);
  }
  try {
    const { initializeWorkspaces } = await import("./workspaces/initialize-workspaces");
    if (request.signal.aborted) return null;
    const { repository } = await initializeWorkspaces(window.indexedDB, window.localStorage);
    if (request.signal.aborted) return null;
    try {
      await repository.dismissOnboarding("welcome");
    } catch {
      // A failed preference write must still allow opening the demo.
    }
    return recoveryDestination ? redirectDocument("/demo") : redirect("/demo");
  } catch (cause) {
    if (recoveryDestination) return redirectDocument("/demo");
    return cause instanceof Error ? cause.message : "Could not open the demo. Please try again.";
  }
}

export function Component() {
  const error = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [tour, setTour] = useState<TourModule | "idle" | "loading" | "failed">("idle");
  const startTour = async () => {
    setTour("loading");
    try {
      const workspace = await loadTour();
      // Navigation can supersede the request while the tour is downloading.
      startTransition(() => setTour((current) => (current === "loading" ? workspace : current)));
    } catch {
      setTour((current) => (current === "loading" ? "failed" : current));
    }
  };

  const open = (destination: "/build" | "/demo" | "/welcome") => {
    if (tour === "failed")
      void submit({ recover: destination }, { method: "post", action: "/welcome" });
    else {
      setTour("idle");
      if (destination === "/demo") void submit({}, { method: "post", action: "/welcome" });
      else void navigate(destination);
    }
  };
  const LiveTour = typeof tour === "object" ? tour.Component : null;
  const loadingTour = tour === "loading" || Boolean(LiveTour);
  const poster = (
    <main className="cabane-app setup-shell onboarding-shell--open mobile-welcome">
      <div className="setup-shell__scene">
        <img
          src={posterImage}
          width={776}
          height={684}
          alt="Cutaway of the furnished demo home and garden"
          fetchPriority="high"
        />
        <button
          type="button"
          className="mobile-welcome__tour"
          onClick={() => (tour === "failed" ? open("/welcome") : void startTour())}
          disabled={loadingTour}
        >
          {loadingTour ? "Loading 3D tour…" : tour === "failed" ? "Reload page" : "Start 3D tour"}
        </button>
      </div>
      <OnboardingIntroduction
        links={onboardingLinks}
        busy={false}
        error={
          error ?? (tour === "failed" ? "The 3D tour couldn’t load. Reload to try again." : null)
        }
        onExplore={() => open("/demo")}
        onBuild={() => open("/build")}
        onDismiss={() => open("/demo")}
      />
      {navigation.state !== "idle" && (
        <div className="mobile-welcome__status" role="status">
          {navigation.location.pathname === "/build" ||
          navigation.formData?.get("recover") === "/build"
            ? "Opening your home…"
            : "Opening the demo…"}
        </div>
      )}
    </main>
  );
  return LiveTour && navigation.state === "idle" ? <LiveTour welcomeFallback={poster} /> : poster;
}
