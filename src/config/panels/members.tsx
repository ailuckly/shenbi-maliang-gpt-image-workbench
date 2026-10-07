import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../i18n";
import { Button, Dialog, Input, Textarea } from "../../v2/ui";
import { configApi } from "../../api";
import type { Team } from "../../types";
import type { ConfigUser } from "../../api/config";
import { ConfirmDialog, CustomSelect, PromptDialog, useToast } from "../../ui";
import { ConfigHeader, SwitchControl, formatDate } from "../shared";

type ConfigUserPayload = {
  account: string;
  username: string;
  email: string;
  phone: string;
  password?: string;
  teamId: string;
  tierId: string;
  disabled: boolean;
  hasConfigAccess: boolean;
};

type UserSwitchConfirm = {
  kind: "status" | "configAccess";
  user: ConfigUser;
};

function userSwitchConfirmCopy(confirm: UserSwitchConfirm | null) {
  if (!confirm) return { title: "", description: "", confirmText: "确认", destructive: false };
  const account = confirm.user.account || confirm.user.username;
  if (confirm.kind === "status") {
    const nextEnabled = confirm.user.disabled;
    return {
      title: nextEnabled ? "启用账号" : "禁用账号",
      description: nextEnabled
        ? `确认启用账号「${account}」？启用后该成员可以继续登录和使用系统。`
        : `确认禁用账号「${account}」？禁用后该成员将无法继续登录和使用系统。`,
      confirmText: nextEnabled ? "启用" : "禁用",
      destructive: !nextEnabled
    };
  }
  const nextAllowed = !confirm.user.hasConfigAccess;
  return {
    title: nextAllowed ? "开启管理权限" : "关闭管理权限",
    description: nextAllowed
      ? `确认给账号「${account}」开启管理权限？开启后该成员可以从头像菜单进入管理后台。`
      : `确认关闭账号「${account}」的管理权限？关闭后该成员将不能从头像菜单进入管理后台。`,
    confirmText: nextAllowed ? "开启" : "关闭",
    destructive: !nextAllowed
  };
}

export function TeamAccountPanel({ onUsers }: { onUsers: (teamId: string) => void }) {
  const cache = useQueryClient();
  const { t } = useI18n();
  const returnFocus = useRef<HTMLButtonElement>(null);
  const teams = useQuery({ queryKey: ["config-teams"], queryFn: configApi.teams });
  const [editing, setEditing] = useState<{ team?: Team } | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const save = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => { if (editing?.team) await configApi.updateTeam(editing.team.id, payload); else await configApi.createTeam(payload); },
    onSuccess: () => { setEditing(null); void cache.invalidateQueries({ queryKey: ["config-teams"] }); }
  });
  const remove = useMutation({ mutationFn: configApi.deleteTeam, onSuccess: () => { setDeleting(null); void cache.invalidateQueries({ queryKey: ["config-teams"] }); } });
  return <section className="v2-page v2-stack">
    <h1>{t("config.nav.teams")}</h1>
    <p>{t("v2.tiers.teamHint")}</p>
    <Button onClick={event => { returnFocus.current = event.currentTarget; save.reset(); setEditing({}); }}>{t("v2.tiers.newTeam")}</Button>
    {teams.error || remove.error ? <p role="alert">{(teams.error || remove.error)?.message}</p> : null}
    <div className="table-wrap"><table>
      <thead><tr><th>{t("v2.admin.name")}</th><th>{t("v2.pack.summary")}</th><th>{t("v2.tiers.members")}</th><th>{t("v2.tiers.actions")}</th></tr></thead>
      <tbody>{teams.data?.teams.map(team => <tr key={team.id}>
        <td><Button variant="ghost" onClick={() => onUsers(team.id)}>{team.name}</Button></td><td>{team.description}</td>
        <td><Button variant="ghost" onClick={() => onUsers(team.id)}>{team.userCount}</Button></td>
        <td><Button onClick={event => { returnFocus.current = event.currentTarget; save.reset(); setEditing({ team }); }}>{t("common.edit")}</Button> <Button variant="danger" onClick={event => { returnFocus.current = event.currentTarget; remove.reset(); setDeleting(team); }}>{t("common.delete")}</Button></td>
      </tr>)}</tbody>
    </table></div>
    {editing ? <TeamDialog key={editing.team?.id ?? "new"} returnFocus={returnFocus} team={editing.team} error={save.error?.message} saving={save.isPending} onClose={() => setEditing(null)} onSubmit={payload => save.mutate(payload)} /> : null}
    <Dialog open={Boolean(deleting)} title={t("v2.tiers.deleteTeam")} returnFocus={returnFocus} description={t("v2.tiers.deleteTeamHint", { name: deleting?.name ?? "" })} onOpenChange={open => { if (!open) setDeleting(null); }}>
      {remove.error ? <p role="alert">{remove.error.message}</p> : null}
      <Button variant="danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{t("common.delete")}</Button>
    </Dialog>
  </section>;
}

export function AccountSearchPanel({ initialTeamId = "" }: { initialTeamId?: string }) {
  const { t } = useI18n();
  const tiers = useQuery({ queryKey: ["config-user-tiers"], queryFn: configApi.userTiers });
  const [tierFilter, setTierFilter] = useState("");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [teamFilter, setTeamFilter] = useState(initialTeamId);
  useEffect(() => setTeamFilter(initialTeamId), [initialTeamId]);
  const [statusFilter, setStatusFilter] = useState("");
  const [userDialog, setUserDialog] = useState<{ mode: "create" | "edit"; user?: ConfigUser } | null>(null);
  const [resetUser, setResetUser] = useState<ConfigUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConfigUser | null>(null);
  const [switchConfirm, setSwitchConfirm] = useState<UserSwitchConfirm | null>(null);
  const switchConfirmCopy = userSwitchConfirmCopy(switchConfirm);
  const registrationSettings = useQuery({
    queryKey: ["config-registration-settings"],
    queryFn: configApi.registrationSettings
  });
  const registrationEnabled = registrationSettings.data?.settings.enabled ?? false;
  const teams = useQuery({ queryKey: ["config-teams"], queryFn: configApi.teams });
  const users = useQuery({
    queryKey: ["config-users", { keyword, teamFilter, tierFilter, statusFilter }],
    queryFn: () => configApi.users({ keyword, teamId: teamFilter, tierId: tierFilter, status: statusFilter })
  });
  const saveRegistrationSettings = useMutation({
    mutationFn: (enabled: boolean) => configApi.saveRegistrationSettings({ enabled }),
    onSuccess: (data) => {
      showToast(data.settings.enabled ? "自助注册已开启" : "自助注册已关闭");
      queryClient.invalidateQueries({ queryKey: ["config-registration-settings"] });
    }
  });
  const createUser = useMutation({
    mutationFn: (payload: ConfigUserPayload & { password: string }) => configApi.createUser(payload),
    onSuccess: () => {
      setUserDialog(null);
      showToast("账号已新增");
      queryClient.invalidateQueries({ queryKey: ["config-users"] });
      queryClient.invalidateQueries({ queryKey: ["config-teams"] });
    }
  });
  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ConfigUserPayload }) =>
      configApi.updateUser(id, payload),
    onSuccess: () => {
      setUserDialog(null);
      showToast("账号已保存");
      queryClient.invalidateQueries({ queryKey: ["config-users"] });
      queryClient.invalidateQueries({ queryKey: ["config-teams"] });
    }
  });
  const toggleUser = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) => configApi.updateUser(id, { disabled }),
    onSuccess: () => {
      showToast("账号状态已更新");
      queryClient.invalidateQueries({ queryKey: ["config-users"] });
    }
  });
  const toggleConfigAccess = useMutation({
    mutationFn: ({ id, hasConfigAccess }: { id: string; hasConfigAccess: boolean }) =>
      configApi.updateUser(id, { hasConfigAccess }),
    onSuccess: () => {
      showToast("管理权限已更新");
      queryClient.invalidateQueries({ queryKey: ["config-users"] });
    }
  });
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => configApi.resetPassword(id, password),
    onSuccess: () => {
      setResetUser(null);
      showToast("密码已重置");
      queryClient.invalidateQueries({ queryKey: ["config-users"] });
    }
  });
  const deleteUser = useMutation({
    mutationFn: (id: string) => configApi.deleteUser(id),
    onSuccess: () => {
      setDeleteTarget(null);
      showToast("账号已删除");
      queryClient.invalidateQueries({ queryKey: ["config-users"] });
      queryClient.invalidateQueries({ queryKey: ["config-teams"] });
    }
  });

  return (
    <section className="config-card">
      <ConfigHeader title="用户账号" desc="支持按账号、邮箱、手机号、团队和状态搜索筛选普通用户。" />
      <div className="switch-row account-registration-row">
        <div className="switch-row-copy">
          <span>自助注册</span>
          <small>关闭后 C 端无法获取注册验证码或完成注册；后台新增账号不受影响。</small>
        </div>
        <SwitchControl
          checked={registrationEnabled}
          disabled={registrationSettings.isLoading || saveRegistrationSettings.isPending}
          label={registrationEnabled ? "已开启" : "已关闭"}
          onChange={(enabled) => saveRegistrationSettings.mutate(enabled)}
        />
      </div>
      {saveRegistrationSettings.error ? <div className="form-error">{saveRegistrationSettings.error.message}</div> : null}
      <div className="filter-bar">
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索账号/用户名/邮箱/手机号" />
        <CustomSelect
          value={teamFilter}
          onChange={setTeamFilter}
          options={[
            { value: "", label: "全部团队" },
            ...(teams.data?.teams.map((team) => ({ value: team.id, label: team.name })) ?? [])
          ]}
        />
        <CustomSelect ariaLabel={t("v2.tiers.tier")} value={tierFilter} onChange={setTierFilter} options={[{ value: "", label: t("v2.tiers.all") }, ...(tiers.data?.tiers.map(tier => ({ value: tier.id, label: tier.name })) ?? [])]} />
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "", label: "全部状态" },
            { value: "enabled", label: "启用" },
            { value: "disabled", label: "禁用" }
          ]}
        />
        <button className="secondary-btn" onClick={() => { createUser.reset(); setUserDialog({ mode: "create" }); }}>
          新增账号
        </button>
      </div>
      {users.error || tiers.error ? <p role="alert">{(users.error || tiers.error)?.message}</p> : null}
      <UserTable
        users={users.data?.users ?? []}
        onEdit={(user) => { updateUser.reset(); setUserDialog({ mode: "edit", user }); }}
        onToggle={(user) => setSwitchConfirm({ kind: "status", user })}
        onConfigAccessToggle={(user) => setSwitchConfirm({ kind: "configAccess", user })}
        onReset={(user) => setResetUser(user)}
        onDelete={(user) => setDeleteTarget(user)}
      />
      {userDialog ? (
        <UserDialog
          mode={userDialog.mode}
          user={userDialog.user}
          teams={teams.data?.teams ?? []}
          error={(userDialog.mode === "create" ? createUser.error : updateUser.error)?.message}
          saving={createUser.isPending || updateUser.isPending}
          defaultTeamId={teamFilter || teams.data?.teams[0]?.id}
          onClose={() => setUserDialog(null)}
          onSubmit={(payload) => {
            if (userDialog.mode === "create") {
              createUser.mutate(payload as ConfigUserPayload & { password: string });
            } else {
              updateUser.mutate({
                id: userDialog.user!.id,
                payload: {
                  account: payload.account,
                  username: payload.username,
                  email: payload.email,
                  phone: payload.phone,
                  teamId: payload.teamId,
                  tierId: payload.tierId,
                  disabled: payload.disabled,
                  hasConfigAccess: payload.hasConfigAccess
                }
              });
            }
          }}
        />
      ) : null}
      <PromptDialog
        open={Boolean(resetUser)}
        title="重置密码"
        label="新密码"
        type="password"
        description={resetUser ? `为账号「${resetUser.account}」设置新密码。` : undefined}
        confirmText="重置密码"
        onCancel={() => setResetUser(null)}
        onSubmit={(password) => {
          if (resetUser) resetPassword.mutate({ id: resetUser.id, password });
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除账号"
        description={deleteTarget ? `确认删除账号「${deleteTarget.account}」？该账号的对话、图片和素材记录会一起删除。` : ""}
        confirmText="删除"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteUser.mutate(deleteTarget.id);
        }}
      />
      <ConfirmDialog
        open={Boolean(switchConfirm)}
        title={switchConfirmCopy.title}
        description={switchConfirmCopy.description}
        confirmText={switchConfirmCopy.confirmText}
        destructive={switchConfirmCopy.destructive}
        onCancel={() => setSwitchConfirm(null)}
        onConfirm={() => {
          if (!switchConfirm) return;
          if (switchConfirm.kind === "status") {
            toggleUser.mutate({ id: switchConfirm.user.id, disabled: !switchConfirm.user.disabled });
          } else {
            toggleConfigAccess.mutate({
              id: switchConfirm.user.id,
              hasConfigAccess: !switchConfirm.user.hasConfigAccess
            });
          }
          setSwitchConfirm(null);
        }}
      />
    </section>
  );
}

function UserTable({
  users,
  onEdit,
  onToggle,
  onConfigAccessToggle,
  onReset,
  onDelete
}: {
  users: ConfigUser[];
  onEdit: (user: ConfigUser) => void;
  onToggle: (user: ConfigUser) => void;
  onConfigAccessToggle: (user: ConfigUser) => void;
  onReset: (user: ConfigUser) => void;
  onDelete: (user: ConfigUser) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>用户名</th>
            <th>账号</th>
            <th>邮箱</th>
            <th>手机号</th>
            <th>团队</th>
            <th>{t("v2.tiers.tier")}</th>
            <th>{t("v2.tiers.today")}</th>
            <th>状态</th>
            <th>管理权限</th>
            <th>对话</th>
            <th>图片</th>
            <th>最近登录</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.account}</td>
              <td>{user.email || "-"}</td>
              <td>{user.phone || "-"}</td>
              <td>{user.teamName}</td>
              <td>{user.tier.name}</td>
              <td>{t("v2.tiers.usage", user.today)}</td>
              <td>
                <SwitchControl
                  checked={!user.disabled}
                  label={user.disabled ? "禁用" : "启用"}
                  onChange={() => onToggle(user)}
                />
              </td>
              <td>
                <SwitchControl
                  checked={user.hasConfigAccess}
                  label={user.hasConfigAccess ? "有" : "无"}
                  onChange={() => onConfigAccessToggle(user)}
                />
              </td>
              <td>{user.sessionCount}</td>
              <td>{user.imageCount}</td>
              <td>{formatDate(user.lastLoginAt)}</td>
              <td>{formatDate(user.createdAt)}</td>
              <td className="row-actions compact-actions">
                <button className="secondary-btn" onClick={() => onEdit(user)}>编辑</button>
                <button className="secondary-btn" onClick={() => onReset(user)}>重置密码</button>
                <button className="danger-btn" onClick={() => onDelete(user)}>删除</button>
              </td>
            </tr>
          ))}
          {users.length === 0 ? (
            <tr>
              <td colSpan={14}>暂无账号</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TeamDialog({ team, error, saving, returnFocus, onClose, onSubmit }: {
  returnFocus: React.RefObject<HTMLButtonElement | null>; team?: Team; error?: string; saving: boolean;
  onClose: () => void; onSubmit: (payload: { name: string; description: string }) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  return <Dialog open returnFocus={returnFocus} title={t(team ? "v2.tiers.editTeam" : "v2.tiers.newTeam")} onOpenChange={open => { if (!open) onClose(); }}>
    <form className="v2-stack" onSubmit={event => { event.preventDefault(); onSubmit({ name, description }); }}>
      <Input label={t("v2.admin.name")} value={name} onChange={event => setName(event.target.value)} required autoFocus />
      <Textarea label={t("v2.pack.summary")} value={description} onChange={event => setDescription(event.target.value)} />
      {error ? <p role="alert">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={saving || !name.trim()}>{t("common.save")}</Button>
    </form>
  </Dialog>;
}

function UserDialog({
  mode,
  user,
  teams,
  defaultTeamId,
  error,
  saving,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  user?: ConfigUser;
  teams: Team[];
  defaultTeamId?: string;
  error?: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ConfigUserPayload) => void;
}) {
  const { t } = useI18n();
  const tiers = useQuery({ queryKey: ["config-user-tiers"], queryFn: configApi.userTiers });
  const [tierId, setTierId] = useState(user?.tierId ?? "");
  const [account, setAccount] = useState(user?.account ?? "");
  const [username, setUsername] = useState(user?.username ?? user?.account ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState(user?.teamId ?? defaultTeamId ?? teams[0]?.id ?? "");
  const [disabled, setDisabled] = useState(user?.disabled ?? false);
  const [hasConfigAccess, setHasConfigAccess] = useState(user?.hasConfigAccess ?? false);

  return (
    <div className="modal-backdrop">
      <section className="case-modal compact-modal">
        <header>
          <h3>{mode === "create" ? "新增账号" : "编辑账号"}</h3>
          <button onClick={onClose}>关闭</button>
        </header>
        <label>
          账号
          <input value={account} onChange={(event) => setAccount(event.target.value)} autoFocus />
        </label>
        <label>
          用户名
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          邮箱
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="可选，用于邮箱登录和找回密码" />
        </label>
        <label>
          手机号
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="可选，手机号登录预留" />
        </label>
        {mode === "create" ? (
          <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        ) : null}
        <label>
          团队
          <CustomSelect
            value={teamId}
            onChange={setTeamId}
            options={teams.map((team) => ({ value: team.id, label: team.name }))}
            placeholder="选择团队"
          />
        </label>
        <label>{t("v2.tiers.tier")}
          <CustomSelect ariaLabel={t("v2.tiers.tier")} value={tierId} onChange={setTierId} options={[{ value: "", label: t("v2.tiers.followDefault") }, ...(tiers.data?.tiers.map(tier => ({ value: tier.id, label: tier.name })) ?? [])]} />
        </label>
        <div className="switch-row">
          <span>账号状态</span>
          <SwitchControl
            checked={!disabled}
            label={disabled ? "禁用" : "启用"}
            onChange={(checked) => setDisabled(!checked)}
          />
        </div>
        <div className="switch-row">
          <span>管理权限</span>
          <SwitchControl
            checked={hasConfigAccess}
            label={hasConfigAccess ? "有" : "无"}
            onChange={setHasConfigAccess}
          />
        </div>
        {error || tiers.error ? <p role="alert">{error || tiers.error?.message}</p> : null}
        <div className="row-actions">
          <button className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-btn"
            disabled={saving || !account.trim() || !teamId || (mode === "create" && !password)}
            onClick={() => onSubmit({ account, username, email, phone, password, teamId, tierId, disabled, hasConfigAccess })}
          >
            保存
          </button>
        </div>
      </section>
    </div>
  );
}
