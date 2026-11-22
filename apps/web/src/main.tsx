import { ApplicationErrorBoundary, ApplicationRouteError } from "./ApplicationErrorBoundary";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useLoaderData,
  useLocation,
  type LoaderFunctionArgs,
} from "react-router";
import "./app-shell.css";
import { HomeEntryScreen } from "./workspaces/HomeEntryScreen";
import { isOAuthUrl, PublicSiteAnalytics } from "./public-site-analytics";

const preventNativeZoom = (event: Event) => event.preventDefault();

window.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false },
);
window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) {
    event.preventDefault();
  }
});
document.addEventListener("gesturestart", preventNativeZoom, { passive: false });
document.addEventListener("gesturechange", preventNativeZoom, { passive: false });

const root = document.getElementById("root");
if (!root) throw new Error("The application root element is missing.");

// Give installed workspaces and desktop visits their usual startup path. Only a
// fresh-looking mobile root needs the additional check for a first demo visit.
function couldBeFirstVisit() {
  try {
    return window.localStorage.length === 0 && window.sessionStorage.length === 0;
  } catch {
    return false;
  }
}

const loadWorkspace = () => import("./HostedWorkspace");
const loadWelcome = () => import("./MobileWelcomeRoute");

const Workspace = lazy(async () => ({ default: (await loadWorkspace()).Component }));
const MobileWelcome = lazy(async () => ({ default: (await loadWelcome()).Component }));

async function loadEntry(args: LoaderFunctionArgs) {
  const { pathname } = new URL(args.request.url);
  if (
    (pathname === "/welcome" || (pathname === "/" && couldBeFirstVisit())) &&
    window.matchMedia("(max-width: 860px), (pointer: coarse)").matches
  ) {
    const result = await (await loadWelcome()).loader(args);
    if (result) return result;
  }
  await loadWorkspace();
  return false;
}

// Keep the wildcard at the root: the workspace's own routes match absolute
// paths, including when an optional live tour opens from the lightweight page.
function HostedEntry() {
  const welcome = useLoaderData<typeof loadEntry>();
  return <Suspense fallback={null}>{welcome ? <MobileWelcome /> : <Workspace />}</Suspense>;
}

function InitialLoading() {
  const { pathname } = useLocation();
  if (pathname === "/demo" && !isOAuthUrl(new URL(window.location.href)))
    return <HomeEntryScreen />;
  if (pathname === "/welcome") return null;
  return (
    <main className="direction-project-loading" role="status">
      Loading your workspaces…
    </main>
  );
}

const router = createBrowserRouter([
  {
    errorElement: <ApplicationRouteError />,
    element: (
      <>
        <PublicSiteAnalytics />
        <Outlet />
      </>
    ),
    children: [
      {
        path: "*",
        loader: loadEntry,
        action: async (args) => {
          if (new URL(args.request.url).pathname !== "/welcome")
            throw new Error("This route does not accept a welcome action.");
          return (await loadWelcome()).action(args);
        },
        HydrateFallback: InitialLoading,
        Component: HostedEntry,
      },
    ],
  },
]);

createRoot(root).render(
  <StrictMode>
    <ApplicationErrorBoundary>
      <RouterProvider router={router} />
    </ApplicationErrorBoundary>
  </StrictMode>,
);
