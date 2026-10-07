import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configApi } from "../../api";
import type { ProviderConfig, PromptOptimizerProvider } from "../../types";
import { useI18n } from "../../i18n";
import {
  emptyProvider,
  providerWithChannelDefaults,
} from "../../config/shared";
import {
  emptyPromptOptimizerProvider,
  normalizePromptOptimizerProvider,
  normalizeProviderForm,
  LanguageModelAssignmentsPanel,
} from "../../config/panels/generation";
import {
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Tabs,
  Tag,
  Textarea,
  useToast,
} from "../ui";
import "./providers.css";
type Settings = ProviderConfig | PromptOptimizerProvider;
export function ProvidersPanel() {
  return <ProviderSettings text={false} />;
}
export function PromptOptimizerPanel() {
  return <ProviderSettings text />;
}
function ProviderSettings({ text }: { text: boolean }) {
  const { t, resolvedLanguage } = useI18n(),
    cache = useQueryClient(),
    { showToast } = useToast();
  const images = useQuery({
    queryKey: ["config-providers"],
    queryFn: configApi.providers,
    enabled: !text,
  });
  const models = useQuery({
    queryKey: ["config-prompt-optimizer-providers"],
    queryFn: configApi.promptOptimizerProviders,
    enabled: text,
  });
  const assignments = useQuery({
    queryKey: ["config-language-model-assignments"],
    queryFn: configApi.languageModelAssignments,
    enabled: text,
  });
  const switches = useQuery({
    queryKey: ["config-global-switches"],
    queryFn: configApi.globalSwitches,
  });
  const webAllowed = switches.data?.switches.some(
    (item) => item.type === "chatgpt_web_entry" && item.enabled,
  );
  const query = text ? models : images,
    providers: Settings[] = query.data?.providers || [],
    defaultId = text
      ? assignments.data?.globalDefault?.resolvedProviderId ||
        assignments.data?.defaultProvider?.providerId
      : images.data?.defaultProviderId;
  const [tab, setTab] = useState("providers"),
    [form, setForm] = useState<Settings | null>(null),
    [editing, setEditing] = useState(false),
    [deleteTarget, setDeleteTarget] = useState<Settings | null>(null),
    [testResult, setTestResult] = useState<{
      ok: boolean;
      message: string;
      checkedAt: string;
      models: string[];
    } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null),
    newButton = useRef<HTMLButtonElement | null>(null);
  const invalidate = () => {
    void cache.invalidateQueries({
      queryKey: [
        text ? "config-prompt-optimizer-providers" : "config-providers",
      ],
    });
    void cache.invalidateQueries({
      queryKey: [text ? "config-language-model-assignments" : "providers"],
    });
  };
  const save = useMutation({
    mutationFn: (next: Settings[]) =>
      text
        ? configApi.savePromptOptimizerProviders(
            next as PromptOptimizerProvider[],
          )
        : configApi.saveProviders(next as ProviderConfig[]),
    onSuccess: () => {
      invalidate();
      if (deleteTarget) trigger.current = newButton.current;
      setForm(null);
      setDeleteTarget(null);
      showToast(t("v2.admin.saved"));
    },
  });
  const test = useMutation({
    mutationFn: async () => {
      const result =
        form && "endpointPath" in form
          ? await configApi.testPromptOptimizerProvider(
              normalizePromptOptimizerProvider(form),
            )
          : await configApi.providerModels(
              normalizeProviderForm(form as ProviderConfig),
            );
      return {
        ok: true,
        message: t("v2.admin.testSuccess", { count: result.models.length }),
        models: result.models,
        checkedAt:
          "availabilityCheckedAt" in result
            ? result.availabilityCheckedAt
            : result.cachedAt || "",
      };
    },
    onSuccess: (result) => {
      setTestResult(result);
      if (form && "endpointPath" in form)
        setForm({
          ...form,
          availableModels: result.models,
          availabilityStatus: "normal",
          availabilityError: "",
          availabilityCheckedAt: result.checkedAt,
        });
      invalidate();
    },
    onError: (error) => {
      const checkedAt = new Date().toISOString();
      setTestResult({
        ok: false,
        message: error.message,
        checkedAt,
        models: [],
      });
      if (form && "endpointPath" in form)
        setForm({
          ...form,
          availabilityStatus: "abnormal",
          availabilityError: error.message,
          availabilityCheckedAt: checkedAt,
        });
      invalidate();
    },
  });
  const patch = (value: Partial<Settings>, connection = false) => {
    setForm((current) =>
      current
        ? {
            ...current,
            ...value,
            ...(connection && "endpointPath" in current
              ? {
                  availableModels: [],
                  availabilityStatus: "unknown" as const,
                  availabilityError: "",
                  availabilityCheckedAt: "",
                }
              : {}),
          }
        : current,
    );
    save.reset();
    if (connection) {
      test.reset();
      setTestResult(null);
    }
  };
  const open = (
    provider: Settings,
    event: React.MouseEvent<HTMLButtonElement>,
    edit: boolean,
  ) => {
    trigger.current = event.currentTarget;
    setEditing(edit);
    setForm(
      "endpointPath" in provider
        ? normalizePromptOptimizerProvider(provider)
        : normalizeProviderForm(provider),
    );
    setTestResult(null);
    test.reset();
    save.reset();
  };
  const date = (value: string) =>
    value
      ? new Date(value).toLocaleString(resolvedLanguage)
      : t("v2.admin.notTested");
  const pending = save.isPending || test.isPending;
  const input = (
    label: string,
    key: string,
    props: Omit<React.ComponentProps<typeof Input>, "label"> = {},
  ) => (
    <Input
      label={t("v2.admin." + label)}
      value={String((form as unknown as Record<string, unknown>)?.[key] ?? "")}
      onChange={(event) =>
        patch(
          { [key]: event.target.value },
          [
            "baseUrl",
            "apiKeyEnv",
            "apiKeyValue",
            "endpointPath",
            "generationPath",
            "responsesPath",
          ].includes(key),
        )
      }
      {...props}
    />
  );
  const list = (
    <section className="v2-provider-panel">
      <header className="v2-row">
        <div>
          <h1>{t(text ? "v2.admin.models" : "v2.admin.providers")}</h1>
          <p>{t("v2.admin.description")}</p>
          {!text && defaultId === "auto" ? (
            <p>{t("v2.admin.autoDefault")}</p>
          ) : null}
        </div>
        <Button
          ref={newButton}
          variant="primary"
          disabled={pending || query.isPending || Boolean(query.error)}
          onClick={(event) =>
            open(
              text
                ? {
                    ...emptyPromptOptimizerProvider(providers.map((p) => p.id)),
                    name: "",
                    baseUrl: "",
                    apiKeyEnv: "",
                    model: "",
                  }
                : {
                    ...emptyProvider(
                      "api",
                      providers.map((p) => p.id),
                    ),
                    name: "",
                    baseUrl: "",
                    apiKeyEnv: "",
                  },
              event,
              false,
            )
          }
        >
          {t("v2.admin.new")}
        </Button>
      </header>
      {query.isPending ? <p role="status">{t("common.loading")}</p> : null}
      {query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {save.error && !form && !deleteTarget ? (
        <ErrorState message={save.error.message} />
      ) : null}
      <div className="v2-provider-list">
        {providers.map((provider) => {
          const probe = images.data?.probes?.[provider.id],
            status =
              "endpointPath" in provider
                ? provider.availabilityStatus
                : probe
                  ? probe.ok
                    ? "normal"
                    : "abnormal"
                  : "unknown",
            error =
              "endpointPath" in provider
                ? provider.availabilityError
                : probe?.error,
            checkedAt =
              "endpointPath" in provider
                ? provider.availabilityCheckedAt
                : probe?.checkedAt;
          return (
            <article className="v2-provider-card" key={provider.id}>
              <header className="v2-row">
                <h2>{provider.name}</h2>
                {provider.id === defaultId ? (
                  <Tag>{t("v2.admin.default")}</Tag>
                ) : null}
                <Tag tone={provider.enabled ? "success" : "neutral"}>
                  {t(provider.enabled ? "v2.pack.enabled" : "v2.pack.disabled")}
                </Tag>
              </header>
              <p>
                {"endpointPath" in provider
                  ? "Chat Completions"
                  : provider.channel + " · " + provider.type}
              </p>
              <dl>
                <div>
                  <dt>{t("v2.admin.model")}</dt>
                  <dd>{provider.model}</dd>
                </div>
                <div>
                  <dt>{t("v2.admin.latest")}</dt>
                  <dd>
                    <Tag
                      tone={
                        status === "normal"
                          ? "success"
                          : status === "abnormal"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {t("v2.admin." + status)}
                    </Tag>{" "}
                    <time>{date(checkedAt || "")}</time>
                    {error ? (
                      <p className="v2-provider-error">{error}</p>
                    ) : null}
                  </dd>
                </div>
              </dl>
              <div className="v2-row">
                <Button
                  disabled={pending}
                  onClick={(event) => open(provider, event, true)}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() =>
                    save.mutate(
                      providers.map((p) =>
                        p.id === provider.id
                          ? { ...p, enabled: !p.enabled }
                          : p,
                      ),
                    )
                  }
                >
                  {t(provider.enabled ? "v2.admin.disable" : "v2.admin.enable")}
                </Button>
                <Button
                  disabled={pending}
                  variant="danger"
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setDeleteTarget(provider);
                    save.reset();
                  }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!query.isPending && !query.error && !providers.length ? (
        <EmptyState title={t("v2.admin.empty")} />
      ) : null}
    </section>
  );
  return (
    <>
      {text ? (
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "providers", label: t("v2.admin.models"), content: list },
            {
              value: "assignments",
              label: t("v2.admin.assignments"),
              content: (
                <LanguageModelAssignmentsPanel
                  providers={models.data?.providers || []}
                />
              ),
            },
          ]}
        />
      ) : (
        list
      )}
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !pending) setForm(null);
        }}
        returnFocus={trigger}
        title={t(editing ? "v2.admin.edit" : "v2.admin.new")}
        description={t("v2.admin.secretNote")}
      >
        {form ? (
          <form
            className="v2-provider-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              const next =
                "endpointPath" in form
                  ? normalizePromptOptimizerProvider(form)
                  : normalizeProviderForm(form);
              save.mutate(
                editing
                  ? providers.map((p) => (p.id === next.id ? next : p))
                  : [...providers, next],
              );
            }}
          >
            <fieldset disabled={pending}>
              <legend>{t("v2.admin.basic")}</legend>
              {input("name", "name", { required: true, maxLength: 100 })}
              {input("id", "id", { readOnly: true })}
              {"channel" in form ? (
                <Select
                  label={t("v2.admin.type")}
                  value={form.channel}
                  onChange={(event) => {
                    setForm(
                      providerWithChannelDefaults(
                        form,
                        event.target.value as ProviderConfig["channel"],
                        { preserveIdentity: true },
                      ),
                    );
                    setTestResult(null);
                  }}
                >
                  <option value="api">API</option>
                  <option value="cpa">CPA</option>
                  {webAllowed || form.channel === "chatgpt_web" ? (
                    <option value="chatgpt_web">ChatGPT Web</option>
                  ) : null}
                </Select>
              ) : null}
              {input("model", "model", {
                required: true,
                maxLength: 256,
                list: "v2-provider-models",
              })}
              <datalist id="v2-provider-models">
                {(
                  testResult?.models ||
                  ("availableModels" in form ? form.availableModels : [])
                ).map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
              <Checkbox
                label={t("v2.pack.enabled")}
                checked={form.enabled}
                onChange={(event) => patch({ enabled: event.target.checked })}
              />
            </fieldset>
            <fieldset disabled={pending}>
              <legend>{t("v2.admin.paths")}</legend>
              {input("baseUrl", "baseUrl", { required: true, type: "url" })}
              {"endpointPath" in form ? (
                input("endpoint", "endpointPath", { required: true })
              ) : (
                <>
                  {input("generationPath", "generationPath", {
                    required: true,
                  })}
                  {input("editPath", "editPath", { required: true })}
                  {input("responsesPath", "responsesPath", { required: true })}
                  {input("responseImagePath", "responseImagePath")}
                </>
              )}
            </fieldset>
            <fieldset disabled={pending}>
              <legend>{t("v2.admin.advanced")}</legend>
              {input("keyEnv", "apiKeyEnv")}
              {input("key", "apiKeyValue", {
                type: "password",
                autoComplete: "new-password",
              })}
              {"endpointPath" in form ? (
                <>
                  <Input
                    label={t("v2.admin.temperature")}
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={form.temperature ?? ""}
                    onChange={(event) =>
                      patch({
                        temperature: event.target.value
                          ? event.target.valueAsNumber
                          : null,
                      })
                    }
                  />
                  <Input
                    label={t("v2.admin.maxTokens")}
                    type="number"
                    min={0}
                    max={16000}
                    value={form.maxTokens}
                    onChange={(event) =>
                      patch({ maxTokens: event.target.valueAsNumber || 0 })
                    }
                  />
                  <Input
                    label={t("v2.admin.retry")}
                    type="number"
                    min={0}
                    max={10}
                    value={form.retryCount}
                    onChange={(event) =>
                      patch({ retryCount: event.target.valueAsNumber || 0 })
                    }
                  />
                  <Input
                    label={t("v2.admin.sort")}
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      patch({ sortOrder: event.target.valueAsNumber || 0 })
                    }
                  />
                  <Checkbox
                    label={t("v2.admin.stream")}
                    checked={form.streamEnabled}
                    onChange={(event) =>
                      patch({ streamEnabled: event.target.checked })
                    }
                  />
                  <Checkbox
                    label={t("v2.admin.thinking")}
                    checked={form.thinkingEnabled}
                    onChange={(event) =>
                      patch({ thinkingEnabled: event.target.checked })
                    }
                  />
                </>
              ) : (
                <>
                  <Select
                    label={t("v2.admin.route")}
                    value={form.routeMode}
                    onChange={(event) =>
                      patch({
                        routeMode: event.target
                          .value as ProviderConfig["routeMode"],
                      })
                    }
                  >
                    {["auto", "images_api", "responses"].map((value) => (
                      <option key={value} value={value}>
                        {t("v2.admin.routeOption." + value)}
                      </option>
                    ))}
                  </Select>
                  <p className="v2-field-hint">{t("v2.admin.routeHint")}</p>
                  {input("responsesModel", "responsesModel")}
                  <p className="v2-field-hint">{t("v2.admin.responsesModelHint")}</p>
                  <Input
                    label={t("v2.admin.sizes")}
                    value={form.sizes.join(",")}
                    onChange={(event) =>
                      patch({
                        sizes: event.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <p className="v2-field-hint">{t("v2.admin.sizesHint")}</p>
                  <Input
                    label={t("v2.admin.qualities")}
                    value={form.qualities.join(",")}
                    onChange={(event) =>
                      patch({
                        qualities: event.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  {input("defaultSize", "defaultSize")}
                  {input("defaultQuality", "defaultQuality")}
                  <Checkbox
                    label={t("v2.admin.proxy")}
                    checked={form.proxyEnabled}
                    onChange={(event) =>
                      patch({ proxyEnabled: event.target.checked }, true)
                    }
                  />
                  {form.channel === "chatgpt_web" ? (
                    <>
                      <Select
                        label={t("v2.admin.quota")}
                        value={form.quotaMode}
                        onChange={(event) =>
                          patch({
                            quotaMode: event.target
                              .value as ProviderConfig["quotaMode"],
                          })
                        }
                      >
                        {[
                          "codex_first",
                          "official_first",
                          "codex_only",
                          "official_only",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </Select>
                      <Input
                        label={t("v2.admin.accountIds")}
                        value={form.webAccountIds.join(",")}
                        onChange={(event) =>
                          patch(
                            {
                              webAccountIds: event.target.value
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            },
                            true,
                          )
                        }
                      />
                      {input("accountId", "webAccountId")}
                      <Select
                        label={t("v2.admin.accountMode")}
                        value={form.webAccountMode}
                        onChange={(event) =>
                          patch({
                            webAccountMode: event.target
                              .value as ProviderConfig["webAccountMode"],
                          })
                        }
                      >
                        {["priority", "round_robin", "random"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </Select>
                      <Textarea
                        label={t("v2.admin.cookies")}
                        value={form.webCookies}
                        onChange={(event) =>
                          patch({ webCookies: event.target.value }, true)
                        }
                      />
                    </>
                  ) : null}
                </>
              )}
            </fieldset>
            <p>{t("v2.admin.testNote")}</p>
            {test.isPending ? (
              <p role="status">{t("v2.admin.testing")}</p>
            ) : null}
            {testResult ? (
              <div
                role="status"
                className={testResult.ok ? "" : "v2-provider-error"}
              >
                <strong>{testResult.message}</strong>
                <p>{date(testResult.checkedAt)}</p>
              </div>
            ) : null}
            {save.error ? <ErrorState message={save.error.message} /> : null}
            <footer className="v2-row">
              <Button disabled={pending} onClick={() => test.mutate()}>
                {t("v2.admin.test")}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {t(save.isPending ? "common.saving" : "common.save")}
              </Button>
            </footer>
          </form>
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setDeleteTarget(null);
        }}
        title={t("v2.admin.delete")}
        description={deleteTarget?.name}
        returnFocus={trigger}
      >
        {save.error ? <ErrorState message={save.error.message} /> : null}
        <Button
          variant="danger"
          disabled={save.isPending}
          onClick={() => {
            save.mutate(providers.filter((p) => p.id !== deleteTarget?.id));
          }}
        >
          {t("common.delete")}
        </Button>
      </Dialog>
    </>
  );
}
