import { lazy, Suspense, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
const SharedWorkbenchShell = lazy(() => import("./components/SharedWorkbenchShell").then(module => ({default: module.SharedWorkbenchShell})));
import { AppUpdateNotifier } from "./components/AppUpdateNotifier";
const WorkbenchShell = lazy(() => import("./components/WorkbenchShell").then(module => ({default: module.WorkbenchShell})));
import { PageLoading } from "./components/PageLoading";
import { useAppearanceMode } from "./hooks/useAppearanceMode";
import { useSyncI18nPreference } from "./i18n";
import { useDocumentBranding } from "./lib/branding";
const LoginPage = lazy(() => import("./v2/pages/LoginPage").then(module => ({default: module.LoginPage})));
import { ToastProvider } from "./ui";
import { useImageCompare } from "./store/imageCompare";

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const branding = useQuery({ queryKey: ["branding"], queryFn: api.branding });
  const loggedIn = Boolean(me.data?.user);
  useEffect(() => {
    if (!me.isLoading) useImageCompare.getState().bindOwner(me.data?.user?.id ?? null);
  }, [me.isLoading, me.data?.user?.id]);
  const sharedRoute = /^\/share\/[^/]+\/?$/.test(location.pathname);
  const searchParams = new URLSearchParams(location.search);
  const authMode = searchParams.get("auth") === "register" ? "register" : searchParams.get("auth") === "login" ? "login" : null;

  const safeNextPath = () => {
    const next = searchParams.get("next") ?? "";
    if (!next.startsWith("/") || next.startsWith("//")) return "";
    try {
      const target = new URL(next, window.location.origin);
      if (target.origin !== window.location.origin) return "";
      const allowedPages = ["/", "/cases", "/assets", "/images", "/images/compare", "/image-provenance", "/prompt-templates", "/help"];
      if (!allowedPages.includes(target.pathname) && target.pathname !== "/oauth/authorize") return "";
      return `${target.pathname}${target.search}`;
    } catch {
      return "";
    }
  };
  const authenticatedNextPath = safeNextPath();

  useDocumentBranding(branding.data);
  useAppearanceMode({ preferredMode: loggedIn ? me.data?.user?.appearanceMode : undefined });
  useSyncI18nPreference(me.data?.user?.preferences.language, loggedIn && !me.isLoading);

  useEffect(() => {
    if (!me.isLoading && loggedIn && authMode && authenticatedNextPath.startsWith("/oauth/authorize")) {
      window.location.replace(authenticatedNextPath);
    }
  }, [authMode, authenticatedNextPath, loggedIn, me.isLoading]);

  const cleanSharedLocation = () => {
    const params = new URLSearchParams(location.search);
    params.delete("auth");
    params.delete("next");
    return `${location.pathname}${params.size > 0 ? `?${params.toString()}` : ""}`;
  };
  if (me.isLoading) {
    return (
      <ToastProvider>
        <PageLoading />
      </ToastProvider>
    );
  }

  if (loggedIn && authMode && authenticatedNextPath.startsWith("/oauth/authorize")) {
    return (
      <ToastProvider>
        <PageLoading />
      </ToastProvider>
    );
  }

  if (loggedIn && authMode && authenticatedNextPath) {
    return <Navigate to={authenticatedNextPath} replace />;
  }

  if (sharedRoute) {
    if (loggedIn && authMode) return <Navigate to={cleanSharedLocation()} replace />;
    if (!loggedIn && authMode) {
      return (
        <ToastProvider>
          <LoginPage
            initialMode={authMode}
            onAuthenticated={() => {
              const next = safeNextPath();
              if (next.startsWith("/oauth/authorize")) window.location.assign(next);
              else navigate(next || cleanSharedLocation(), { replace: true });
            }}
          />
        </ToastProvider>
      );
    }
    return (
      <ToastProvider>
        {me.data?.user ? (
          <>
            <WorkbenchShell user={me.data.user} />
            <AppUpdateNotifier />
          </>
        ) : <SharedWorkbenchShell />}
      </ToastProvider>
    );
  }

  if (!me.data?.user) {
    return (
      <ToastProvider>
        <LoginPage
          initialMode={authMode ?? "login"}
          onAuthenticated={() => {
            const next = safeNextPath();
            if (next.startsWith("/oauth/authorize")) window.location.assign(next);
            else navigate(next || location.pathname, { replace: true });
          }}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <WorkbenchShell user={me.data.user} />
      <AppUpdateNotifier />
    </ToastProvider>
  );
}

export default function App() {
  return <Suspense fallback={<PageLoading />}><AppContent /></Suspense>;
}
