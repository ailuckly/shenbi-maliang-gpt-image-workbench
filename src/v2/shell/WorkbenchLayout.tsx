import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import * as Drawer from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, History, Images, MessageCirclePlus, MoreHorizontal, PanelLeft, Palette, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { ProjectLogo } from "../../components/ProjectLogo";
import { absoluteShareUrl } from "../../components/ShareConversationDialog";
import { useAppearanceMode } from "../../hooks/useAppearanceMode";
import { languagePreferenceOptions, useI18n, type LanguagePreference } from "../../i18n";
import type { AppearanceMode } from "../../lib/appearance";
import { copyTextToClipboard } from "../../lib/clipboard";
import type { ChatSession, User } from "../../types";
import { Button, Dialog, EmptyState, ErrorState, Input, Menu, Select, Skeleton, Tag, useToast } from "../ui";
import "./shell.css";

type Props = {
  user: User; siteName: string; sourceCodeUrl?: string;
  mobileOpen: boolean; onMobileOpenChange: (open: boolean) => void;
  sessions: ChatSession[]; loading: boolean; error?: string; hasMore: boolean; loadingMore: boolean; sentinel: RefObject<HTMLDivElement | null>;
  pending: boolean; onLoadMore: () => void; onNew: () => void; onSearch: (trigger: HTMLButtonElement) => void; onSettings: () => void; onLogout: () => void;
  onTheme: (mode: AppearanceMode) => void; onLanguage: (language: LanguagePreference) => void; preferencesSaving: boolean;
  onRename: (session: ChatSession, title: string) => void; onPin: (session: ChatSession) => void; onArchive: (session: ChatSession) => void; onDelete: (session: ChatSession) => void;
  onSessionOpen: (session: ChatSession) => void; onNavigate: (event: MouseEvent<HTMLAnchorElement>, path: string) => void; children: ReactNode;
};

export function WorkbenchLayout(props: Props) {
  const { t, language, resolvedLanguage, setLanguage } = useI18n(); const { setMode, resolvedMode } = useAppearanceMode(); const { showToast } = useToast();
  const [preference, setPreference] = useState<"theme" | "language" | null>(null);
  const preferenceControl = useRef<HTMLElement | null>(null);
  useEffect(() => { if (!props.preferencesSaving && document.activeElement === document.body) preferenceControl.current?.focus(); }, [props.preferencesSaving]);
  const actionTrigger = useRef<HTMLElement | null>(null); const mobileTrigger = useRef<HTMLButtonElement | null>(null); const location = useLocation();
  const [rename, setRename] = useState<ChatSession | null>(null); const [title, setTitle] = useState("");
  const [share, setShare] = useState<ChatSession | null>(null); const queryClient = useQueryClient();
  const shareMutation = useMutation({
    mutationFn: async (session: ChatSession) => {
      const { messages } = await api.messages(session.id);
      if (!messages.length) throw new Error(t("v2.shell.shareEmpty"));
      return api.createSessionShareLink(session.id, messages.map(message => message.id), true);
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["session-share-links"] }); }
  });
  const closeDrawer = () => props.onMobileOpenChange(false);
  const nav = [
    { path: "/images", label: t("sidebar.images"), Icon: Images },
    { path: "/assets", label: t("sidebar.assets"), Icon: FolderOpen },
    { path: "/style-packs", label: t("v2.shell.stylePacks"), Icon: Palette }
  ];
  const menuItems = [
    { label: t("sidebar.settings"), onSelect: () => { closeDrawer(); props.onSettings(); } },
    { label: t("settings.language.title"), onSelect: () => { closeDrawer(); setPreference("language"); } },
    { label: t("v2.shell.theme"), onSelect: () => { closeDrawer(); setPreference("theme"); } },
    { label: t("sidebar.help"), onSelect: () => { closeDrawer(); navigate("/help"); } },
    { label: t("sidebar.logout"), danger: true, onSelect: () => { closeDrawer(); props.onLogout(); } }
  ];
  const navigate = useNavigate();
  const sidebar = <div className="v2-sidebar-inner">
    <div className="v2-sidebar-brand"><ProjectLogo alt="" /><strong>{props.siteName}</strong></div>
    <nav className="v2-sidebar-nav" aria-label={t("v2.shell.navigation")}>
      <Button variant="primary" onClick={() => { closeDrawer(); props.onNew(); }}><MessageCirclePlus size={18} aria-hidden="true" />{t("v2.shell.new")}</Button>
      <Button variant="ghost" onClick={event => { const trigger=props.mobileOpen ? mobileTrigger.current ?? event.currentTarget : event.currentTarget; closeDrawer(); props.onSearch(trigger); }}><History size={18} aria-hidden="true" />{t("v2.shell.history")}</Button>
      {nav.map(({ path, label, Icon }) => <NavLink key={path} to={path} className="v2-nav-link" onClick={event => props.onNavigate(event, path)}><Icon size={18} aria-hidden="true" />{label}</NavLink>)}
    </nav>
    <div className="v2-sidebar-history"><h2>{t("sidebar.recent")}</h2>
      {props.loading ? <Skeleton /> : null}{props.error ? <ErrorState message={props.error} onRetry={props.onLoadMore} /> : null}
      {!props.loading && !props.error && !props.sessions.length ? <p className="v2-sidebar-empty">{t("sidebar.emptyChats")}</p> : null}
      {props.sessions.map(session => <div className="v2-session-row" key={session.id} data-session-id={session.id}>
        <NavLink className="v2-session-link" to={`/chat/${session.id}`} title={session.title} onClick={() => { closeDrawer(); props.onSessionOpen(session); }}><span>{session.titleStatus === "pending" ? t("sidebar.titlePending") : session.title || t("sidebar.defaultSessionTitle")}</span>{session.pinnedAt ? <span className="v2-session-pin" aria-label={t("sidebar.pinned")}>·</span> : null}{session.runningImageJobCount > 0 ? <Tag>{t("sidebar.imageRunning")}</Tag> : null}</NavLink>
        <Menu trigger={<Button variant="ghost" className="v2-session-menu" disabled={props.pending} onFocus={event => { actionTrigger.current=props.mobileOpen ? mobileTrigger.current : event.currentTarget; }} onPointerDown={event => { actionTrigger.current=props.mobileOpen ? mobileTrigger.current : event.currentTarget; }} aria-label={t("v2.shell.sessionActions", { title: session.title })}><MoreHorizontal size={18} aria-hidden="true" /></Button>} items={[
          { label: t("sidebar.renameChat"), onSelect: () => { setTitle(session.title); closeDrawer(); setRename(session); } },
          { label: t(session.pinnedAt ? "sidebar.unpinChat" : "sidebar.pinChat"), onSelect: () => props.onPin(session) },
          { label: t("v2.shell.share"), onSelect: () => { shareMutation.reset(); closeDrawer(); setShare(session); } },
          { label: t("sidebar.archiveChat"), onSelect: () => { closeDrawer(); props.onArchive(session); } },
          { label: t("common.delete"), danger: true, onSelect: () => { closeDrawer(); props.onDelete(session); } }
        ]} />
      </div>)}
      {props.hasMore ? <div ref={props.sentinel}><Button variant="ghost" disabled={props.loadingMore} onClick={props.onLoadMore}>{t(props.loadingMore ? "common.loading" : "v2.shell.loadMore")}</Button></div> : null}
    </div>
    <div className="v2-sidebar-footer"><Menu trigger={<Button variant="ghost" className="v2-user-trigger" onFocus={event => { actionTrigger.current=props.mobileOpen ? mobileTrigger.current : event.currentTarget; }} onPointerDown={event => { actionTrigger.current=props.mobileOpen ? mobileTrigger.current : event.currentTarget; }} aria-label={t("v2.shell.userMenu")}><span className="v2-user-avatar" aria-hidden="true">{props.user.avatarUrl ? <img src={props.user.avatarUrl} alt="" /> : props.user.username.slice(0, 1).toUpperCase()}</span><span>{props.user.username}</span><MoreHorizontal size={18} aria-hidden="true" /></Button>} items={menuItems} />
      {props.sourceCodeUrl ? <a className="v2-source-link" href={props.sourceCodeUrl} target="_blank" rel="noreferrer">{t("common.sourceCode")}</a> : null}
    </div>
  </div>;
  return <div className={`app-shell v2-shell${location.pathname === "/images/compare" ? " image-compare-route" : ""}`}><aside className="v2-sidebar">{sidebar}</aside>
    <Drawer.Root open={props.mobileOpen} onOpenChange={props.onMobileOpenChange}><header className="v2-mobile-header"><Drawer.Trigger asChild><Button ref={mobileTrigger} variant="ghost" aria-label={t("sidebar.openMenu")}><PanelLeft size={20} aria-hidden="true" /></Button></Drawer.Trigger><strong>{props.siteName}</strong></header>
      <Drawer.Portal><Drawer.Overlay className="v2-modal-backdrop" /><Drawer.Content className="v2-mobile-drawer" aria-describedby={undefined}><Drawer.Title className="visually-hidden">{t("v2.shell.navigation")}</Drawer.Title><Drawer.Close asChild><Button variant="ghost" className="v2-drawer-close" aria-label={t("sidebar.closeMenu")}><X size={18} aria-hidden="true" /></Button></Drawer.Close>{sidebar}</Drawer.Content></Drawer.Portal>
    </Drawer.Root>
    <div className="v2-shell-body">{props.children}</div>
    <Dialog returnFocus={actionTrigger} open={Boolean(rename)} onOpenChange={open => { if (!open) setRename(null); }} title={t("sidebar.renameChat")}><form onSubmit={event => { event.preventDefault(); if (rename && title.trim()) { props.onRename(rename, title.trim()); setRename(null); } }}><Input label={t("sidebar.editChatTitle")} value={title} maxLength={200} required onChange={event => setTitle(event.target.value)} autoFocus /><Button variant="primary" type="submit" disabled={props.pending || !title.trim()}>{t("common.save")}</Button></form></Dialog>
    <Dialog returnFocus={actionTrigger} open={Boolean(preference)} onOpenChange={open => { if (!open) setPreference(null); }} title={t(preference === "language" ? "settings.language.title" : "v2.shell.theme")}>
      {preference === "language" ? <Select label={t("settings.language.title")} value={language} disabled={props.preferencesSaving} onChange={event => { preferenceControl.current = event.currentTarget; const value = event.target.value as LanguagePreference; setLanguage(value); props.onLanguage(value); }}>{languagePreferenceOptions(t, resolvedLanguage).map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</Select> : <div className="v2-row">{(["light", "dark"] as const).map(mode => <Button key={mode} aria-pressed={resolvedMode === mode} disabled={props.preferencesSaving} onClick={event => { preferenceControl.current = event.currentTarget; setMode(mode); props.onTheme(mode); }}>{t(`v2.${mode}`)}</Button>)}</div>}
    </Dialog>
    <Dialog returnFocus={actionTrigger} open={Boolean(share)} onOpenChange={open => { if (!open) setShare(null); }} title={t("v2.shell.share")} description={t("v2.shell.shareScope")}>
      {shareMutation.error ? <ErrorState message={shareMutation.error.message} /> : null}
      {shareMutation.data ? <div className="v2-stack"><Input label={t("shareDialog.linkLabel")} value={absoluteShareUrl(shareMutation.data.shareLink)} readOnly /><Button onClick={async () => { const copied = await copyTextToClipboard(absoluteShareUrl(shareMutation.data!.shareLink)); showToast(t(copied ? "shareDialog.copied" : "shareDialog.copyFailed"), copied ? "success" : "error"); }}>{t("shareDialog.copy")}</Button></div> : <Button variant="primary" disabled={shareMutation.isPending} onClick={() => { if (share) shareMutation.mutate(share); }}>{t(shareMutation.isPending ? "common.loading" : "v2.shell.createShare")}</Button>}
    </Dialog>
  </div>;
}

export function HistoryDialog({ sessions, onClose, returnFocus }: { sessions: ChatSession[]; onClose: () => void; returnFocus?:RefObject<HTMLElement|null> }) {
  const { t } = useI18n(); const navigate = useNavigate(); const [keyword, setKeyword] = useState(""); const [search, setSearch] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setSearch(keyword.trim()), 200); return () => window.clearTimeout(timer); }, [keyword]);
  const results = useQuery({ queryKey: ["global-search", "chat", search], queryFn: ({ signal }) => api.globalSearch({ q: search, scope: "chat", limit: 80, offset: 0 }, { signal }), enabled: Boolean(search) });
  const rows = keyword.trim() !== search ? [] : search ? results.data?.groups.flatMap(group => group.items).map(item => ({ id: item.id, title: item.title })) ?? [] : sessions;
  return <Dialog returnFocus={returnFocus} open onOpenChange={open => { if (!open) onClose(); }} title={t("v2.shell.history")}><div className="v2-stack"><Input label={t("v2.shell.searchHistory")} value={keyword} onChange={event => setKeyword(event.target.value)} autoFocus />
    {results.isFetching || keyword.trim() !== search ? <Skeleton /> : null}{results.error ? <ErrorState message={results.error.message} onRetry={() => void results.refetch()} /> : null}
    <div className="v2-history-results">{rows.map(row => <Button key={row.id} variant="ghost" onClick={() => { onClose(); navigate(`/chat/${row.id}`); }}>{row.title || t("sidebar.defaultSessionTitle")}</Button>)}{!results.isFetching && keyword.trim() === search && !results.error && !rows.length ? <EmptyState title={t("sidebar.emptyChats")} /> : null}</div>
  </div></Dialog>;
}
