import { useEffect, useState, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { api } from "../../api";
import { ProjectLogo } from "../../components/ProjectLogo";
import { useAppearanceMode } from "../../hooks/useAppearanceMode";
import { useI18n } from "../../i18n";
import { DEFAULT_SITE_NAME } from "../../lib/branding";
import { DEFAULT_SOURCE_CODE_URL } from "../../lib/sourceCode";
import { clearRememberedAccount, readRememberedAccount, writeRememberedAccount } from "../../lib/loginAssets";
import { Button, Checkbox, Dialog, ErrorState, Input, useToast } from "../ui";
import type { LoginEntryMode } from "../../pages/LoginPage";
import "./login.css";

type LoginMode = LoginEntryMode | "reset";
const emailAddress = (value: string) => value.trim().toLowerCase();
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress(value));

function PasswordField(props: ComponentProps<typeof Input>) {
  const { t } = useI18n(); const [visible, setVisible] = useState(false);
  return <div className="v2-password"><Input {...props} type={visible ? "text" : "password"} /><Button variant="ghost" className="v2-password-toggle" aria-label={t(visible ? "login.hidePassword" : "login.showPassword")} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</Button></div>;
}

export function LoginPage({ initialMode = "login", onAuthenticated }: { initialMode?: LoginEntryMode; onAuthenticated?: () => void } = {}) {
  const queryClient = useQueryClient(); const { t } = useI18n(); const { showToast } = useToast();
  const { resolvedMode, setMode: setAppearance } = useAppearanceMode();
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [account, setAccount] = useState(readRememberedAccount); const [password, setPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(() => Boolean(readRememberedAccount()));
  const [registerEmail, setRegisterEmail] = useState(""); const [registerCode, setRegisterCode] = useState("");
  const [registerPassword, setRegisterPassword] = useState(""); const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [resetEmail, setResetEmail] = useState(""); const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState(""); const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [registerCooldown, setRegisterCooldown] = useState(0); const [resetCooldown, setResetCooldown] = useState(0);
  const [fieldError, setFieldError] = useState<{ id: string; message: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const registrationStatus = useQuery({ queryKey: ["registration-status"], queryFn: api.registrationStatus });
  const branding = useQuery({ queryKey: ["branding"], queryFn: api.branding });
  const registrationEnabled = registrationStatus.data?.enabled === true;
  const siteName = branding.data?.siteName?.trim() || DEFAULT_SITE_NAME;
  const fail = (id: string, error: Error) => { setFieldError({ id, message: error.message }); document.getElementById(id)?.focus(); };
  const errorFor = (id: string) => fieldError?.id === id ? fieldError.message : undefined;
  const authenticated = async () => { await queryClient.invalidateQueries({ queryKey: ["me"] }); onAuthenticated?.(); };
  const login = useMutation({
    mutationFn: () => api.login(account, password),
    onSuccess: async () => { if (rememberAccount) writeRememberedAccount(account); else clearRememberedAccount(); await authenticated(); },
    onError: error => fail("login-account", error)
  });
  const sendRegisterCode = useMutation({
    mutationFn: () => { if (!validEmail(registerEmail)) throw new Error(t("login.invalidEmail")); return api.sendRegisterCode(emailAddress(registerEmail)); },
    onSuccess: data => { setRegisterCooldown(data.cooldownSeconds); showToast(t("login.codeSent")); },
    onError: error => fail("register-email", error)
  });
  const register = useMutation({
    mutationFn: () => {
      if (registerPassword.length < 6) throw new Error(t("login.passwordTooShort"));
      if (registerPassword !== registerConfirmPassword) throw new Error(t("login.passwordMismatch"));
      if (!validEmail(registerEmail)) throw new Error(t("login.invalidEmail"));
      return api.register({ email: emailAddress(registerEmail), code: registerCode, password: registerPassword, inviteCode: "" });
    },
    onSuccess: authenticated,
    onError: error => fail(registerPassword.length < 6 ? "register-password" : registerPassword !== registerConfirmPassword ? "register-confirm" : !validEmail(registerEmail) ? "register-email" : "register-code", error)
  });
  const sendPasswordResetCode = useMutation({
    mutationFn: () => { if (!validEmail(resetEmail)) throw new Error(t("login.invalidEmail")); return api.sendPasswordResetCode(emailAddress(resetEmail)); },
    onSuccess: data => { setResetCooldown(data.cooldownSeconds); showToast(t("login.codeSent")); },
    onError: error => fail("reset-email", error)
  });
  const passwordReset = useMutation({
    mutationFn: () => {
      if (resetPassword.length < 6) throw new Error(t("login.passwordTooShort"));
      if (resetPassword !== resetConfirmPassword) throw new Error(t("login.passwordMismatch"));
      if (!validEmail(resetEmail)) throw new Error(t("login.invalidEmail"));
      return api.resetPasswordByEmail({ email: emailAddress(resetEmail), code: resetCode, password: resetPassword });
    },
    onSuccess: () => { setMode("login"); setAccount(emailAddress(resetEmail)); setPassword(""); setFieldError(null); showToast(t("login.resetSuccess")); },
    onError: error => fail(resetPassword.length < 6 ? "reset-password" : resetPassword !== resetConfirmPassword ? "reset-confirm" : !validEmail(resetEmail) ? "reset-email" : "reset-code", error)
  });
  const switchMode = (next: LoginMode) => {
    if (next === "register" && !registrationEnabled) return;
    setMode(next); setFieldError(null); login.reset(); register.reset(); sendRegisterCode.reset(); passwordReset.reset(); sendPasswordResetCode.reset();
  };
  useEffect(() => { if (!registrationStatus.isPending && !registrationEnabled && mode === "register") { setMode("login"); setFieldError(null); } }, [mode, registrationEnabled, registrationStatus.isPending]);
  useEffect(() => {
    if (registerCooldown <= 0 && resetCooldown <= 0) return;
    const timer = window.setInterval(() => { setRegisterCooldown(value => Math.max(0, value - 1)); setResetCooldown(value => Math.max(0, value - 1)); }, 1000);
    return () => window.clearInterval(timer);
  }, [registerCooldown, resetCooldown]);

  const flow = ["optimize", "generate", "edit"];
  return <main className="v2-page v2-login">
    <header className="v2-login-header"><div className="v2-login-brand"><ProjectLogo alt="" /><span>{siteName}</span></div>
      <Dialog open={guideOpen} onOpenChange={setGuideOpen} title={t("v2.login.guide")} trigger={<Button variant="ghost">{t("v2.login.guide")}</Button>}><ol className="v2-stack">{flow.map(step => <li key={step}><strong>{t(`v2.login.flow.${step}`)}</strong><p>{t(`v2.login.guide.${step}`)}</p></li>)}</ol></Dialog>
    </header>
    <div className="v2-login-content">
      <aside className="v2-login-intro"><div className="v2-login-intro-full"><p className="v2-login-kicker">{t("v2.login.workspace")}</p><h1>{t("v2.login.headline")}</h1><p className="v2-login-copy">{t("v2.login.description")}</p>
        <ol className="v2-login-flow">{flow.map((step, index) => <li key={step}><span className="v2-login-number">0{index + 1}</span><strong>{t(`v2.login.flow.${step}`)}</strong><span>{t(`v2.login.flow.${step}Description`)}</span></li>)}</ol>
      </div><p className="v2-login-compact-flow">{t("v2.login.compactFlow")}</p></aside>
      <section className="v2-login-panel" aria-labelledby="v2-login-title"><h2 id="v2-login-title">{t(mode === "login" ? "v2.login.title" : mode === "register" ? "login.register" : "login.resetPassword")}</h2><p className="v2-login-welcome">{t("v2.login.welcome", { name: siteName })}</p>
        {registrationStatus.error ? <ErrorState message={registrationStatus.error.message} onRetry={() => void registrationStatus.refetch()} /> : null}
        {mode === "login" ? <form className="v2-stack" onSubmit={event => { event.preventDefault(); setFieldError(null); login.mutate(); }}>
          <Input id="login-account" label={t("login.account")} placeholder={t("login.accountPlaceholder")} autoComplete="username" autoFocus required value={account} onChange={event => setAccount(event.target.value)} error={errorFor("login-account")} />
          <PasswordField id="login-password" label={t("login.password")} placeholder={t("login.passwordPlaceholder")} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
          <div className="v2-login-options"><Checkbox label={t("login.rememberAccount")} checked={rememberAccount} onChange={event => { setRememberAccount(event.target.checked); if (!event.target.checked) clearRememberedAccount(); }} /><Button variant="ghost" onClick={() => switchMode("reset")}>{t("login.forgotPassword")}</Button></div>
          <Button type="submit" variant="primary" disabled={login.isPending}>{t(login.isPending ? "login.loggingIn" : "login.login")}</Button>
        </form> : null}
        {mode === "register" && registrationEnabled ? <form className="v2-stack" onSubmit={event => { event.preventDefault(); setFieldError(null); register.mutate(); }}>
          <Input id="register-email" label={t("login.email")} placeholder={t("login.emailPlaceholder")} type="email" autoComplete="email" autoFocus required value={registerEmail} onChange={event => setRegisterEmail(event.target.value)} error={errorFor("register-email")} />
          <div className="v2-code-row"><Input id="register-code" label={t("login.code")} inputMode="numeric" autoComplete="one-time-code" required value={registerCode} onChange={event => setRegisterCode(event.target.value)} error={errorFor("register-code")} /><Button disabled={sendRegisterCode.isPending || registerCooldown > 0 || !registerEmail.trim()} onClick={() => { setFieldError(null); sendRegisterCode.mutate(); }}>{registerCooldown > 0 ? `${registerCooldown}s` : t(sendRegisterCode.isPending ? "login.sending" : "login.getCode")}</Button></div>
          <PasswordField id="register-password" label={t("login.password")} placeholder={t("login.registerPasswordPlaceholder")} autoComplete="new-password" required value={registerPassword} onChange={event => setRegisterPassword(event.target.value)} error={errorFor("register-password")} />
          <PasswordField id="register-confirm" label={t("login.confirmPassword")} placeholder={t("login.confirmPasswordPlaceholder")} autoComplete="new-password" required value={registerConfirmPassword} onChange={event => setRegisterConfirmPassword(event.target.value)} error={errorFor("register-confirm")} />
          <Button type="submit" variant="primary" disabled={register.isPending}>{t(register.isPending ? "login.registering" : "login.registerSubmit")}</Button>
        </form> : null}
        {mode === "reset" ? <form className="v2-stack" onSubmit={event => { event.preventDefault(); setFieldError(null); passwordReset.mutate(); }}>
          <Input id="reset-email" label={t("login.email")} placeholder={t("login.resetEmailPlaceholder")} type="email" autoComplete="email" autoFocus required value={resetEmail} onChange={event => setResetEmail(event.target.value)} error={errorFor("reset-email")} />
          <div className="v2-code-row"><Input id="reset-code" label={t("login.emailCode")} inputMode="numeric" autoComplete="one-time-code" required value={resetCode} onChange={event => setResetCode(event.target.value)} error={errorFor("reset-code")} /><Button disabled={sendPasswordResetCode.isPending || resetCooldown > 0 || !resetEmail.trim()} onClick={() => { setFieldError(null); sendPasswordResetCode.mutate(); }}>{resetCooldown > 0 ? `${resetCooldown}s` : t(sendPasswordResetCode.isPending ? "login.sending" : "login.getCode")}</Button></div>
          <PasswordField id="reset-password" label={t("login.newPassword")} placeholder={t("login.resetPasswordPlaceholder")} autoComplete="new-password" required value={resetPassword} onChange={event => setResetPassword(event.target.value)} error={errorFor("reset-password")} />
          <PasswordField id="reset-confirm" label={t("login.confirmResetPassword")} placeholder={t("login.confirmResetPasswordPlaceholder")} autoComplete="new-password" required value={resetConfirmPassword} onChange={event => setResetConfirmPassword(event.target.value)} error={errorFor("reset-confirm")} />
          <Button type="submit" variant="primary" disabled={passwordReset.isPending}>{t(passwordReset.isPending ? "login.resetting" : "login.resetPassword")}</Button>
        </form> : null}
        <div className="v2-login-entry">{mode !== "login" ? <Button variant="ghost" onClick={() => switchMode("login")}>{t("login.backToLogin")}</Button> : registrationEnabled ? <Button variant="ghost" onClick={() => switchMode("register")}>{t("v2.login.registerEntry")}</Button> : registrationStatus.data ? <p>{t("v2.login.contactAdmin")}</p> : null}</div>
      </section>
    </div>
    <footer className="v2-login-footer"><span>{t("v2.login.footer", { name: siteName })}</span><div className="v2-row"><Button variant="ghost" aria-pressed={resolvedMode === "light"} onClick={() => setAppearance("light")}>{t("v2.light")}</Button><Button variant="ghost" aria-pressed={resolvedMode === "dark"} onClick={() => setAppearance("dark")}>{t("v2.dark")}</Button>{(branding.data?.showGithubEntry ?? true) ? <a href={branding.data?.sourceCodeUrl || DEFAULT_SOURCE_CODE_URL} target="_blank" rel="noreferrer">{t("common.sourceCode")}</a> : null}</div></footer>
  </main>;
}
