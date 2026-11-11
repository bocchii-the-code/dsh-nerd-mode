window.__ModuleLoader__.load({
  id: 'dsh-nerd-mode/client',
  factory(require) {
    const React = require('react');
    const { Toast } = require('@deepseek-ai/dsh-client-ui-primitives');

    const SLOT = 'conversation.input.left';
    const SETTINGS_SLOT = 'settings.section';
    const LABEL = 'Nerd Mode';
    const SETTINGS_NAMESPACE = 'dsh-nerd-mode';
    const SETTINGS_DEFAULTS = Object.freeze({
      recallSessionEnabled: false,
      unseenQuestionCount: 3,
      unseenQuestionType: 'short-answer',
    });

    function settingsValues(snapshot) {
      const value = snapshot?.value ?? {};
      const base = snapshot?.base ?? {};
      const user = snapshot?.user ?? {};
      return {
        recallSessionEnabled: value.recallSessionEnabled ?? user.recallSessionEnabled ?? base.recallSessionEnabled ?? SETTINGS_DEFAULTS.recallSessionEnabled,
        unseenQuestionCount: String(value.unseenQuestionCount ?? user.unseenQuestionCount ?? base.unseenQuestionCount ?? SETTINGS_DEFAULTS.unseenQuestionCount),
        unseenQuestionType: value.unseenQuestionType ?? user.unseenQuestionType ?? base.unseenQuestionType ?? SETTINGS_DEFAULTS.unseenQuestionType,
      };
    }

    function settingsOperations(draft, snapshot) {
      const base = snapshot?.base ?? {};
      const user = snapshot?.user ?? {};
      const operations = [];
      for (const [key, value] of Object.entries({
        recallSessionEnabled: draft.recallSessionEnabled,
        unseenQuestionCount: Number(draft.unseenQuestionCount),
        unseenQuestionType: draft.unseenQuestionType,
      })) {
        const inherited = base[key] ?? SETTINGS_DEFAULTS[key];
        if (value === inherited) {
          if (Object.hasOwn(user, key)) operations.push({ op: 'unset', path: [key] });
        } else if (!Object.hasOwn(user, key) || user[key] !== value) {
          operations.push({ op: 'set', path: [key], value });
        }
      }
      return operations;
    }

    function validSettings(draft) {
      const count = Number(draft.unseenQuestionCount);
      return draft.unseenQuestionCount !== ''
        && Number.isInteger(count)
        && count >= 0
        && count <= 10
        && ['short-answer', 'multiple-choice', 'mixed'].includes(draft.unseenQuestionType);
    }

    function sameSettings(left, right) {
      return left.recallSessionEnabled === right.recallSessionEnabled
        && left.unseenQuestionCount === right.unseenQuestionCount
        && left.unseenQuestionType === right.unseenQuestionType;
    }

    const MARKET_API = '/dsh-market/api/v1';
    const PACKAGE = 'dsh-nerd-mode';
    const UPDATE_SCHEMA = 'dsh-market/update-api/v1';
    const REQUEST_TIMEOUT = 10000;
    const POLL_INTERVAL = 1000;

    function useT(locale) {
      React.useSyncExternalStore(
        (listener) => locale.subscribe(listener),
        () => locale.getSnapshot(),
        () => locale.getSnapshot(),
      );
      return (text) => locale.resolveText(text);
    }

    // Every Market call carries the session cookies and gives up after 10 s.
    async function marketRequest(url, options = {}, life = null) {
      const controller = new AbortController();
      if (life !== null) life.controller = controller;
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const response = await fetch(url, {
          credentials: 'same-origin',
          ...options,
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, body };
      } catch (error) {
        if (controller.signal.aborted) throw new Error('DSH Market did not answer within 10 seconds.');
        throw error;
      } finally {
        clearTimeout(timer);
        if (life !== null && life.controller === controller) life.controller = null;
      }
    }

    function marketFailure(result, fallback) {
      const body = result?.body ?? {};
      return body.error
        ?? body.failure?.message
        ?? body.failure?.code
        ?? `${fallback} (HTTP ${result?.status ?? 0}).`;
    }

    // The schema is optional on the operation endpoints, but a wrong one is a different API.
    const wrongSchema = (body) => body?.schema !== undefined && body.schema !== UPDATE_SCHEMA;

    async function readCapabilities(life) {
      const result = await marketRequest(`${MARKET_API}/capabilities`, {}, life);
      const body = result.body ?? {};
      if (!result.ok) throw new Error(marketFailure(result, 'DSH Market did not answer'));
      if (body.schema !== UPDATE_SCHEMA || body.features?.update !== true) {
        throw new Error('DSH Market does not support plugin updates.');
      }
      const endpoints = body.endpoints ?? {};
      if (typeof endpoints.updates !== 'string' || typeof endpoints.operations !== 'string') {
        throw new Error('DSH Market returned no update endpoints.');
      }
      return {
        endpoints: { updates: endpoints.updates, operations: endpoints.operations },
        profile: typeof body.profile === 'string' ? body.profile : null,
        restart: body.features.restart === true && typeof endpoints.restart === 'string' ? endpoints.restart : null,
      };
    }

    async function readRelease(market, force, life) {
      const url = `${market.endpoints.updates}?name=${encodeURIComponent(PACKAGE)}${force ? '&force=1' : ''}`;
      const result = await marketRequest(url, {}, life);
      const body = result.body ?? {};
      if (!result.ok) throw new Error(marketFailure(result, 'DSH Market did not check for an update'));
      if (body.schema !== UPDATE_SCHEMA || typeof body.package !== 'object' || body.package === null) {
        throw new Error('DSH Market returned no release for this plugin.');
      }
      return body.package;
    }

    const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

    // Only a plain `major.minor.patch` pair can prove the local copy is newer.
    function compareVersions(left, right) {
      const first = VERSION.exec(String(left ?? ''));
      const second = VERSION.exec(String(right ?? ''));
      if (first === null || second === null) return 0;
      for (let at = 1; at <= 3; at += 1) {
        const difference = Number(first[at]) - Number(second[at]);
        if (difference !== 0) return difference;
      }
      return 0;
    }

    const manualCommand = (profile) => `dsh plugin --profile ${profile ?? '<profile>'} add ${PACKAGE}`;

    function NerdModeSettingsEntry({ configForms, close, locale }) {
      return React.createElement(
        'div',
        { 'data-nerd-mode-settings': '', style: settingsColumnStyle },
        React.createElement(NerdModeSettingsBody, { configForms, close, locale }),
        React.createElement(AboutGroup, { locale }),
      );
    }

    function NerdModeSettingsBody({ configForms, close, locale }) {
      const t = useT(locale);
      const description = configForms.describe();
      const described = React.useSyncExternalStore(
        (listener) => description.subscribe(listener),
        () => description.getSnapshot(),
        () => description.getSnapshot(),
      );
      const settingsExist = described.view?.namespaces.some(({ ns }) => ns === SETTINGS_NAMESPACE) === true;
      if (!settingsExist) {
        const loading = (described.status === 'idle' || described.status === 'loading') && !described.error;
        return React.createElement(React.Fragment, null,
          React.createElement('p', {
            role: 'status',
            'aria-busy': loading,
            style: feedbackStyle,
          }, loading
            ? t({ en: 'Loading Nerd Mode settings…', zh: '正在加载 Nerd Mode 设置…' })
            : described.status === 'ready'
              ? t({ en: 'Nerd Mode settings are unavailable in this profile.', zh: '此 profile 中没有 Nerd Mode 设置。' })
              : t({ en: 'Nerd Mode settings could not be loaded. Refresh the Settings window and try again.', zh: '无法加载 Nerd Mode 设置。请刷新设置窗口后重试。' })),
          loading ? null : React.createElement('button', {
            type: 'button',
            onClick: close,
            style: secondaryButtonStyle,
          }, t({ en: 'Close', zh: '关闭' })),
        );
      }
      return React.createElement(NerdModeSettings, {
        close,
        locale,
        scope: configForms.get(SETTINGS_NAMESPACE),
      });
    }

    function NerdModeSettings({ scope, close, locale }) {
      const t = useT(locale);
      const snapshot = React.useSyncExternalStore(
        (listener) => scope.subscribe(listener),
        () => scope.getSnapshot(),
        () => scope.getSnapshot(),
      );
      const [draft, setDraft] = React.useState(() => snapshot?.status === 'ready' ? settingsValues(snapshot) : null);
      const [saving, setSaving] = React.useState(false);
      const [feedback, setFeedback] = React.useState(null);
      React.useEffect(() => {
        if (draft === null && snapshot?.status === 'ready') {
          setDraft(settingsValues(snapshot));
        }
      }, [draft, snapshot?.status]);
      if (snapshot?.status === 'loading' || snapshot?.status === 'idle' || snapshot?.status === 'ready' && draft === null) {
        return React.createElement('p', {
          role: 'status',
          'aria-busy': true,
          style: feedbackStyle,
        }, t({ en: 'Loading Nerd Mode settings…', zh: '正在加载 Nerd Mode 设置…' }));
      }
      if (snapshot?.status !== 'ready') {
        return React.createElement(React.Fragment, null,
          React.createElement('p', { role: 'status', style: feedbackStyle },
            snapshot?.status === 'unavailable'
              ? t({ en: 'Nerd Mode settings are unavailable in this profile.', zh: '此 profile 中没有 Nerd Mode 设置。' })
              : t({ en: 'Nerd Mode settings could not be loaded. Refresh the Settings window and try again.', zh: '无法加载 Nerd Mode 设置。请刷新设置窗口后重试。' })),
          React.createElement('button', {
            type: 'button',
            onClick: close,
            style: secondaryButtonStyle,
          }, t({ en: 'Close', zh: '关闭' })),
        );
      }
      const current = settingsValues(snapshot);
      const dirty = !sameSettings(draft, current);
      const writable = snapshot.writable === true;
      const updateDraft = (key, value) => {
        setDraft((previous) => ({ ...previous, [key]: value }));
        setFeedback(null);
      };
      const restoreDefaults = () => {
        setDraft({
          ...SETTINGS_DEFAULTS,
          unseenQuestionCount: String(SETTINGS_DEFAULTS.unseenQuestionCount),
        });
        setFeedback(null);
      };
      const cancel = () => {
        setDraft(settingsValues(scope.getSnapshot()));
        setFeedback(null);
      };
      const save = async () => {
        const latest = scope.getSnapshot();
        if (latest?.status !== 'ready' || !validSettings(draft) || latest.writable !== true) return;
        const operations = settingsOperations(draft, latest);
        if (operations.length === 0) return;
        setSaving(true);
        setFeedback(null);
        try {
          const accepted = await scope.mutate(operations, latest.revision);
          if (accepted === false) {
            throw new Error(t({ en: 'The profile rejected these settings.', zh: 'profile 拒绝了这些设置。' }));
          }
          setDraft(settingsValues(scope.getSnapshot()));
          setFeedback({
            tone: 'status',
            text: {
              en: 'Saved to this profile. Changes apply to the next study-plus session.',
              zh: '已保存到此 profile。更改将在下次 study-plus 会话中生效。',
            },
          });
        } catch (error) {
          setFeedback({
            tone: 'alert',
            text: {
              en: `Could not save settings: ${error?.message ?? 'the profile rejected the changes'}`,
              zh: `无法保存设置：${error?.message ?? 'profile 拒绝了这些更改'}`,
            },
          });
        } finally {
          setSaving(false);
        }
      };

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'header',
          { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          React.createElement('h2', {
            style: { fontSize: 16, fontWeight: 600, lineHeight: '24px', margin: 0 },
          }, t({ en: 'Nerd Mode', zh: 'Nerd Mode' })),
          React.createElement('p', {
            style: {
              color: 'var(--dsw-alias-label-tertiary)',
              fontSize: 14,
              lineHeight: '22px',
              margin: 0,
            },
          }, t({ en: 'Profile defaults for new study-plus sessions.', zh: '新 study-plus 会话的 profile 默认值。' })),
        ),
        React.createElement(
          'section',
          {
            'data-settings-group': 'recall-session',
            style: groupStyle,
          },
          React.createElement(
            'div',
            { style: { minWidth: 0 } },
            React.createElement('h3', { style: groupTitleStyle }, t({ en: 'Recall Session / 课前回忆', zh: '课前回忆' })),
            React.createElement('p', { style: groupDescriptionStyle }, t({ en: 'One ungraded recall question before teaching.', zh: '讲授前的一次不计分课前回忆。' })),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              role: 'switch',
              'aria-checked': draft.recallSessionEnabled,
              'aria-label': t({ en: 'Recall Session', zh: '课前回忆' }),
              'data-setting': 'recallSessionEnabled',
              'data-state': draft.recallSessionEnabled ? 'on' : 'off',
              disabled: !writable || saving,
              onClick: () => updateDraft('recallSessionEnabled', !draft.recallSessionEnabled),
              style: switchStyle(draft.recallSessionEnabled, !writable || saving),
            },
            React.createElement('span', null, draft.recallSessionEnabled
              ? t({ en: 'On', zh: '开' })
              : t({ en: 'Off', zh: '关' })),
            React.createElement('span', {
              'aria-hidden': 'true',
              style: {
                background: 'currentColor',
                borderRadius: '50%',
                height: 8,
                opacity: draft.recallSessionEnabled ? 1 : 0.5,
                width: 8,
              },
            }),
          ),
        ),
        React.createElement(
          'section',
          {
            'data-settings-group': 'post-lecture-questions',
            style: groupStyle,
          },
          React.createElement(
            'div',
            null,
            React.createElement('h3', { style: groupTitleStyle }, t({ en: 'Post-lecture questions', zh: '课后提问' })),
            React.createElement('p', { style: groupDescriptionStyle }, t({ en: 'Choose how many unseen questions follow each lecture.', zh: '选择每节课后出几道题。' })),
          ),
          React.createElement(
            'div',
            { style: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' } },
            React.createElement(
              'label',
              { htmlFor: 'nerd-mode-question-count', style: fieldLabelStyle },
              React.createElement('span', null, t({ en: 'Question count', zh: '题数' })),
              React.createElement('input', {
                id: 'nerd-mode-question-count',
                type: 'number',
                min: 0,
                max: 10,
                step: 1,
                inputMode: 'numeric',
                value: draft.unseenQuestionCount,
                'data-setting': 'unseenQuestionCount',
                disabled: !writable || saving,
                onChange: (event) => updateDraft('unseenQuestionCount', event.target.value),
                style: fieldControlStyle,
              }),
              React.createElement('span', { style: fieldHintStyle }, t({ en: 'Use 0 to skip unseen questions.', zh: '设为 0 可跳过课后提问。' })),
            ),
            React.createElement(
              'label',
              { htmlFor: 'nerd-mode-question-type', style: fieldLabelStyle },
              React.createElement('span', null, t({ en: 'Question type', zh: '题型' })),
              React.createElement(
                'select',
                {
                  id: 'nerd-mode-question-type',
                  value: draft.unseenQuestionType,
                  'data-setting': 'unseenQuestionType',
                  disabled: !writable || saving,
                  onChange: (event) => updateDraft('unseenQuestionType', event.target.value),
                  style: fieldControlStyle,
                },
                React.createElement('option', { value: 'short-answer' }, t({ en: 'Short answer', zh: '简答' })),
                React.createElement('option', { value: 'multiple-choice' }, t({ en: 'Multiple choice', zh: '四选一' })),
                React.createElement('option', { value: 'mixed' }, t({ en: 'Mixed', zh: '混合' })),
              ),
              React.createElement('span', { style: fieldHintStyle }, t({ en: 'Mixed chooses a type for each question.', zh: '混合会为每道题随机选题型。' })),
            ),
          ),
        ),
        React.createElement(
          'footer',
          {
            style: {
              alignItems: 'center',
              borderTop: '1px solid var(--dsw-alias-border-l2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'space-between',
              paddingTop: 16,
            },
          },
          React.createElement('button', {
            type: 'button',
            disabled: !writable || saving,
            onClick: restoreDefaults,
            style: secondaryButtonStyle,
          }, t({ en: 'Restore defaults', zh: '恢复默认' })),
          React.createElement(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' } },
            React.createElement('button', {
              type: 'button',
              disabled: !dirty || saving,
              onClick: cancel,
              style: secondaryButtonStyle,
            }, t({ en: 'Cancel', zh: '取消' })),
            React.createElement('button', {
              type: 'button',
              disabled: !dirty || !validSettings(draft) || !writable || saving,
              onClick: save,
              style: primaryButtonStyle,
            }, saving ? t({ en: 'Saving…', zh: '保存中…' }) : t({ en: 'Save', zh: '保存' })),
          ),
        ),
        snapshot?.writable === false
          ? React.createElement('p', { role: 'status', style: feedbackStyle }, t({ en: 'These profile settings are read-only.', zh: '这些 profile 设置为只读。' }))
          : null,
        feedback === null
          ? null
          : React.createElement('p', {
            role: feedback.tone,
            style: feedbackStyle,
          }, t(feedback.text)),
      );
    }

    function AboutGroup({ locale }) {
      const t = useT(locale);
      const [life] = React.useState(() => ({ cancelled: false, timer: null, controller: null }));
      const [view, setView] = React.useState({ phase: 'checking' });

      // An answer that arrives after the panel closed writes nothing.
      const show = (next) => {
        if (!life.cancelled) setView(next);
      };

      async function check(force) {
        setView({ phase: 'checking' });
        let market;
        try {
          market = await readCapabilities(life);
        } catch {
          show({ phase: 'unavailable' });
          return;
        }
        try {
          const release = await readRelease(market, force, life);
          show({ phase: 'ready', market, release, confirming: false, linkedNote: false });
        } catch (error) {
          show({
            phase: 'failed',
            market,
            release: null,
            message: error?.message ?? 'The update check failed.',
            retry: 'check',
            force: false,
          });
        }
      }

      function follow(market, operationId, release) {
        return new Promise((resolve, reject) => {
          const tick = async () => {
            if (life.cancelled) {
              resolve(null);
              return;
            }
            let result;
            try {
              result = await marketRequest(`${market.endpoints.operations}?operationId=${encodeURIComponent(operationId)}`, {}, life);
            } catch (error) {
              reject(error);
              return;
            }
            if (life.cancelled) {
              resolve(null);
              return;
            }
            if (!result.ok || wrongSchema(result.body)) {
              reject(new Error(marketFailure(result, 'The update could not be followed')));
              return;
            }
            const operation = result.body?.operation ?? {};
            if (operation.state === 'succeeded') {
              resolve(operation);
              return;
            }
            if (operation.state === 'failed' || operation.state === 'cancelled' || operation.state === 'rolled-back') {
              const error = new Error(operation.failure?.message ?? operation.failure?.code ?? `The update ${operation.state}.`);
              error.code = operation.failure?.code ?? null;
              reject(error);
              return;
            }
            show({ phase: 'updating', market, release, progress: operation.state ?? 'running' });
            life.timer = setTimeout(tick, POLL_INTERVAL);
          };
          tick();
        });
      }

      async function install(market, release, force) {
        setView({ phase: 'updating', market, release, progress: 'queued' });
        try {
          const result = await marketRequest(market.endpoints.updates, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ packageName: PACKAGE, ...(force ? { force: true } : {}) }),
          }, life);
          if (!result.ok || wrongSchema(result.body)) {
            const error = new Error(marketFailure(result, 'The update did not start'));
            error.code = result.body?.failure?.code ?? null;
            throw error;
          }
          const operationId = result.body?.operation?.operationId;
          if (typeof operationId !== 'string') throw new Error('DSH Market returned no operation to follow.');
          const operation = await follow(market, operationId, release);
          if (operation === null) return;
          show({
            phase: 'installed',
            market,
            release,
            version: operation.installedVersion ?? release.latestVersion,
            restartNeeded: operation.outcome?.restartRequired === true,
            restarting: false,
            restartSent: false,
          });
        } catch (error) {
          const code = error?.code ?? null;
          show({
            phase: 'failed',
            market,
            release,
            message: error?.message ?? 'The update failed.',
            retry: 'install',
            force: code === 'RELEASE_TOO_FRESH' || code === 'VERSION_UNCHANGED',
          });
        }
      }

      async function restart(current) {
        setView({ ...current, restarting: true });
        try {
          const result = await marketRequest(current.market.restart, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          }, life);
          if (!result.ok) throw new Error(marketFailure(result, 'DSH could not restart'));
          show({ ...current, restarting: false, restartSent: true });
        } catch (error) {
          show({
            phase: 'failed',
            market: current.market,
            release: current.release,
            message: error?.message ?? 'DSH could not restart.',
            retry: 'check',
            force: false,
          });
        }
      }

      React.useEffect(() => {
        check(false);
        return () => {
          life.cancelled = true;
          if (life.timer !== null) clearTimeout(life.timer);
          if (life.controller !== null) life.controller.abort();
        };
      }, []);

      const busy = view.phase === 'checking' || view.phase === 'updating' || view.restarting === true;
      const button = (text, onClick, disabled = false, primary = false) => React.createElement('button', {
        type: 'button',
        disabled,
        onClick,
        style: primary ? primaryButtonStyle : secondaryButtonStyle,
      }, text);
      const code = (text) => React.createElement('code', { style: commandStyle }, text);
      const checkAgain = button(t({ en: 'Check again', zh: '重新检查' }), () => check(true));
      const versions = (release) => t({
        en: `Installed v${release.installedVersion} · latest v${release.latestVersion}`,
        zh: `已安装 v${release.installedVersion} · 最新 v${release.latestVersion}`,
      });

      let versionLine = null;
      const feedback = [];
      let actions = null;

      if (view.phase === 'checking') {
        versionLine = t({ en: 'Checking…', zh: '正在检查…' });
      } else if (view.phase === 'unavailable') {
        feedback.push(t({
          en: 'DSH Market is not available on this host, so Nerd Mode cannot check for updates. Run this command in a terminal:',
          zh: '此主机上没有 DSH Market，因此 Nerd Mode 无法检查更新。请在终端运行：',
        }));
        feedback.push(code(manualCommand(null)));
      } else if (view.phase === 'failed') {
        if (view.release !== null) versionLine = versions(view.release);
        feedback.push(t({ en: 'The update did not finish: ', zh: '更新未完成：' }));
        feedback.push(view.message);
        feedback.push(t({ en: ' Install it by hand with:', zh: ' 可手动安装：' }));
        feedback.push(code(manualCommand(view.market?.profile ?? null)));
        actions = [button(t({ en: 'Try again', zh: '重试' }), () => {
          if (view.retry === 'install') install(view.market, view.release, view.force === true);
          else check(true);
        })];
      } else if (view.phase === 'installed') {
        versionLine = t({ en: `Installed v${view.version}`, zh: `已安装 v${view.version}` });
        feedback.push(view.restartSent
          ? t({ en: `DSH is restarting to load v${view.version}.`, zh: `DSH 正在重启以加载 v${view.version}。` })
          : t({ en: `Restart DSH to use v${view.version}.`, zh: `重启 DSH 以使用 v${view.version}。` }));
        actions = view.restartNeeded && view.market.restart !== null && view.restartSent !== true
          ? [button(
              t({ en: view.restarting ? 'Restarting…' : 'Restart now', zh: view.restarting ? '正在重启…' : '立即重启' }),
              () => restart(view),
              view.restarting === true,
              true,
            )]
          : [checkAgain];
      } else if (view.release.source === 'linked') {
        versionLine = t({ en: `Local v${view.release.installedVersion}`, zh: `本地 v${view.release.installedVersion}` });
        actions = [button(t({ en: 'About local installs', zh: '关于本地安装' }), () => {
          setView({ ...view, linkedNote: view.linkedNote !== true });
        })];
        if (view.linkedNote === true) {
          feedback.push(t({ en: 'This copy is linked to a folder. Update it with git, not npm.', zh: '此副本链接到本地文件夹。请用 git 更新，不要用 npm。' }));
        }
      } else if (view.phase === 'updating') {
        versionLine = versions(view.release);
        feedback.push(t({ en: `Update in progress (${view.progress}).`, zh: `更新进行中（${view.progress}）。` }));
        actions = [button(t({ en: 'Updating…', zh: '正在更新…' }), () => {}, true)];
      } else if (view.release.updateAvailable === true) {
        versionLine = versions(view.release);
        if (view.confirming === true) {
          feedback.push(t({
            en: `Install v${view.release.latestVersion} and restart DSH afterwards?`,
            zh: `安装 v${view.release.latestVersion} 并在之后重启 DSH？`,
          }));
          actions = [
            button(t({ en: 'Cancel', zh: '取消' }), () => setView({ ...view, confirming: false })),
            button(t({ en: 'Update', zh: '更新' }), () => install(view.market, view.release, false), false, true),
          ];
        } else {
          actions = [button(
            t({ en: `Update to v${view.release.latestVersion}`, zh: `更新到 v${view.release.latestVersion}` }),
            () => setView({ ...view, confirming: true }),
            false,
            true,
          )];
        }
      } else if (compareVersions(view.release.installedVersion, view.release.latestVersion) > 0) {
        versionLine = t({
          en: `Local v${view.release.installedVersion} · npm v${view.release.latestVersion}`,
          zh: `本地 v${view.release.installedVersion} · npm v${view.release.latestVersion}`,
        });
        feedback.push(t({ en: 'This copy is newer than npm. No update.', zh: '此副本比 npm 上的版本更新，无需更新。' }));
        actions = [checkAgain];
      } else {
        versionLine = versions(view.release);
        actions = [checkAgain];
      }

      return React.createElement(
        'div',
        { 'data-settings-group': 'about', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        React.createElement(
          'div',
          { style: groupStyle },
          React.createElement(
            'div',
            { style: { minWidth: 0 } },
            React.createElement('h3', { style: groupTitleStyle }, t({ en: 'About', zh: '关于' })),
            versionLine === null ? null : React.createElement('p', { style: groupDescriptionStyle }, versionLine),
          ),
          actions === null ? null : React.createElement(
            'div',
            { style: { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' } },
            ...actions,
          ),
        ),
        React.createElement('p', {
          role: view.phase === 'failed' ? 'alert' : 'status',
          'aria-busy': busy,
          style: feedbackStyle,
        }, ...feedback),
      );
    }

    const settingsColumnStyle = {
      boxSizing: 'border-box',
      color: 'var(--dsw-alias-label-primary)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--dsw-font-family, inherit)',
      gap: 16,
      maxWidth: 720,
      paddingBottom: 24,
      width: '100%',
    };

    const groupStyle = {
      alignItems: 'center',
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 'var(--dsw-radius-sm)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 18,
      justifyContent: 'space-between',
      padding: 20,
    };
    const groupTitleStyle = {
      fontSize: 14,
      fontWeight: 600,
      lineHeight: '22px',
      margin: 0,
    };
    const groupDescriptionStyle = {
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: 13,
      lineHeight: '20px',
      margin: '3px 0 0',
    };
    const fieldLabelStyle = {
      display: 'flex',
      flexDirection: 'column',
      fontSize: 13,
      fontWeight: 500,
      gap: 7,
      minWidth: 0,
    };
    const fieldControlStyle = {
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l3)',
      borderRadius: 'var(--dsw-radius-sm, 6px)',
      boxSizing: 'border-box',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
      height: 38,
      minWidth: 0,
      padding: '0 10px',
      width: '100%',
    };
    const fieldHintStyle = {
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: 12,
      fontWeight: 400,
      lineHeight: '18px',
    };
    const secondaryButtonStyle = {
      background: 'transparent',
      border: '1px solid var(--dsw-alias-border-l3)',
      borderRadius: 'var(--dsw-radius-sm, 6px)',
      color: 'var(--dsw-alias-label-primary)',
      cursor: 'pointer',
      font: 'inherit',
      minHeight: 36,
      padding: '0 12px',
    };
    const primaryButtonStyle = {
      ...secondaryButtonStyle,
      background: 'var(--dsw-alias-bg-layer-1)',
      borderColor: 'var(--dsw-alias-state-business-primary)',
      color: 'var(--dsw-alias-state-business-primary)',
      fontWeight: 600,
    };
    const feedbackStyle = {
      color: 'var(--dsw-alias-label-secondary)',
      fontSize: 13,
      lineHeight: '20px',
      margin: 0,
    };
    const commandStyle = {
      background: 'var(--dsw-alias-bg-layer-2)',
      borderRadius: 'var(--dsw-radius-sm, 6px)',
      display: 'inline-block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      lineHeight: '18px',
      padding: '2px 6px',
      wordBreak: 'break-all',
    };

    function switchStyle(active, disabled) {
      const accent = 'var(--dsw-alias-state-business-primary)';
      return {
        alignItems: 'center',
        background: active ? 'var(--dsw-alias-state-business-tertiary)' : 'var(--dsw-alias-bg-layer-2)',
        border: `1px solid ${active ? accent : 'var(--dsw-alias-border-l3)'}`,
        borderRadius: 'var(--dsw-radius-sm, 6px)',
        color: active ? accent : 'var(--dsw-alias-label-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        flexShrink: 0,
        font: 'inherit',
        gap: 8,
        justifyContent: 'center',
        minHeight: 36,
        minWidth: 72,
        padding: '0 10px',
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
      };
    }

    // 16px book, same footprint as the Full Throttle bolt.
    const BOOK = React.createElement(
      'svg',
      {
        'aria-hidden': 'true',
        fill: 'none',
        height: 16,
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: 1.6,
        viewBox: '0 0 16 16',
        width: 16,
      },
      React.createElement('path', {
        d: 'M2.5 3.2A1.7 1.7 0 0 1 4.2 1.5H7.5v11H4.2a1.7 1.7 0 0 0-1.7 1.7z',
      }),
      React.createElement('path', {
        d: 'M13.5 3.2a1.7 1.7 0 0 0-1.7-1.7H8.5v11h3.3a1.7 1.7 0 0 1 1.7 1.7z',
      }),
    );

    // The theme owns the colors; only the state picks which alias to read.
    function pillStyle(active) {
      if (active) {
        const business = 'var(--dsw-alias-state-business-primary)';
        return {
          background: `color-mix(in srgb, ${business} 16%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${business} 55%, transparent)`,
          color: business,
        };
      }
      return {
        background: 'var(--dsw-alias-fill-tsp-secondary)',
        boxShadow: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        opacity: 0.65,
      };
    }

    // Unknown commands resolve as { ok: true, value: undefined }; they never
    // reach the command executor and write nothing to the session log.
    function failureText(result) {
      if (!result?.ok) {
        return `Nerd Mode did not switch: ${result?.error?.message ?? 'the host rejected the command'}`;
      }
      if (result.value == null) {
        return 'Nerd Mode did not switch: /nerd-mode is not available in this build.';
      }
      const outcome = result.value.result;
      if (outcome?.kind === 'error') {
        return `Nerd Mode did not switch: ${outcome.text ?? 'the command failed'}`;
      }
      return null;
    }

    function NerdModeToggle({ useProjection, execute }) {
      const state = useProjection('studyMode');
      const active = state?.active === true;
      const [busy, setBusy] = React.useState(false);
      const [failure, setFailure] = React.useState(null);
      const [toast, setToast] = React.useState(null);

      React.useEffect(() => {
        setFailure(null);
        setToast(null);
      }, [active]);

      const onClick = async () => {
        if (busy) return;
        setBusy(true);
        setFailure(null);
        setToast(null);
        try {
          const result = await execute(active ? '/nerd-mode off' : '/nerd-mode on');
          const text = failureText(result);
          if (text !== null) {
            setFailure(text);
            setToast({ id: Date.now(), text });
          }
        } catch (error) {
          const text = failureText({ ok: false, error });
          setFailure(text);
          setToast({ id: Date.now(), text });
        } finally {
          setBusy(false);
        }
      };

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            role: 'switch',
            'aria-checked': active,
            'aria-label': LABEL,
            'data-state': active ? 'on' : 'off',
            title: failure ?? (active ? 'Nerd Mode is on' : 'Nerd Mode is off'),
            disabled: busy,
            onMouseDown: (event) => event.preventDefault(),
            onClick,
            style: {
              alignItems: 'center',
              border: 'none',
              borderRadius: 'var(--dsw-radius-sm)',
              cursor: busy ? 'progress' : 'pointer',
              display: 'inline-flex',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 500,
              gap: 6,
              height: 28,
              lineHeight: '20px',
              padding: '0 8px',
              transition: 'background 120ms ease, color 120ms ease',
              ...pillStyle(active),
            },
          },
          BOOK,
          React.createElement('span', null, LABEL),
        ),
        toast === null
          ? null
          : React.createElement(Toast, {
              key: toast.id,
              text: toast.text,
              onDone: () => setToast(null),
            }),
      );
    }

    // The conversation view bar, driven by the entries in `conversation.view`.
    // Live build orders: chat 0, trajectory 10, context 20, fleet 30.
    const VIEW_SLOT = 'conversation.view';
    const VIEW_ID = 'study';
    const VIEW_LABEL = 'Study';
    const VIEW_ORDER = 100;
    const TRACKER_ROOT = 'study';
    // One selection shared by the Study tab and the Lectures tab. This is a
    // classic script, so a module-level binding is the whole mechanism.
    let activeCourse = null;
    const DASH = '—';

    /** Return the Course both tabs show: `activeCourse` while it exists, otherwise the first of the name-sorted `courses`. */
    function pickCourse(courses) {
      return activeCourse !== null && courses.includes(activeCourse) ? activeCourse : courses[0] ?? null;
    }

    // --- Tracker parsing -----------------------------------------------------
    // Parsing lives here because the client bundle is a classic script: a
    // relative require throws and an export statement is invalid.

    function splitRow(line) {
      return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    }

    function tableBlocks(text) {
      const blocks = [];
      let current = null;
      for (const line of String(text ?? '').split(/\r?\n/)) {
        if (!line.trim().startsWith('|')) {
          current = null;
          continue;
        }
        const cells = splitRow(line);
        if (cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
        if (current === null) {
          current = { header: cells, rows: [] };
          blocks.push(current);
        } else {
          current.rows.push(cells);
        }
      }
      return blocks;
    }

    const columnOf = (block, name) => block.header
      .findIndex((cell) => cell.toLowerCase() === name.toLowerCase());

    function parseDate(value) {
      const match = /^\d{4}-\d{2}-\d{2}/.exec(String(value ?? '').trim());
      return match ? match[0] : null;
    }

    function parseGraph(text) {
      const lines = String(text ?? '').split(/\r?\n/);
      let topic = null;
      let book = null;
      const chapters = new Map();
      let inChapters = false;
      for (const line of lines) {
        const trimmed = line.trim();
        // A new graph says Course and an older graph says Topic; both keep their title.
        const topicMatch = /^#\s*(?:Course|Topic):\s*(.+)$/i.exec(trimmed);
        if (topicMatch) topic = topicMatch[1].trim();
        const bookMatch = /^Book:\s*(.+)$/i.exec(trimmed);
        if (bookMatch) book = bookMatch[1].trim();
        if (/^##\s*Chapters\s*$/i.test(trimmed)) {
          inChapters = true;
          continue;
        }
        if (!inChapters) continue;
        const chapterRow = /^(\d+)\.\s*(.+?)(?::.*)?$/.exec(trimmed);
        if (chapterRow) chapters.set(Number(chapterRow[1]), chapterRow[2].trim());
        else if (trimmed !== '') inChapters = false;
      }

      const table = tableBlocks(text).find((block) => columnOf(block, 'Concept') !== -1);
      const concepts = [];
      let malformed = 0;
      if (table) {
        const nameAt = columnOf(table, 'Concept');
        const chapterAt = columnOf(table, 'Chapter');
        const sectionAt = columnOf(table, 'Section');
        table.rows.forEach((cells, position) => {
          if (cells.length !== table.header.length || cells[nameAt] === '') {
            malformed += 1;
            return;
          }
          const chapter = chapterAt === -1 ? 1 : Number.parseInt(cells[chapterAt], 10);
          const section = sectionAt === -1 ? concepts.length + 1 : Number.parseInt(cells[sectionAt], 10);
          concepts.push({
            name: cells[nameAt],
            chapter: Number.isInteger(chapter) && chapter > 0 ? chapter : 1,
            section: Number.isInteger(section) && section > 0 ? section : position + 1,
            order: position,
          });
        });
      }
      return { topic, book, chapters, concepts, malformed };
    }

    function parseState(text) {
      const table = tableBlocks(text).find((block) => columnOf(block, 'State') !== -1);
      const states = new Map();
      let malformed = 0;
      if (!table) return { states, malformed };
      const nameAt = columnOf(table, 'Concept');
      const stateAt = columnOf(table, 'State');
      const dateAt = columnOf(table, 'Last evidence');
      for (const cells of table.rows) {
        if (cells.length !== table.header.length || cells[nameAt] === '') {
          malformed += 1;
          continue;
        }
        states.set(cells[nameAt], {
          state: cells[stateAt].toLowerCase(),
          date: dateAt === -1 ? null : parseDate(cells[dateAt]),
        });
      }
      return { states, malformed };
    }

    function parseLog(text) {
      const blocks = [];
      let current = null;
      for (const line of String(text ?? '').split(/\r?\n/)) {
        const heading = /^##\s+(.+)$/.exec(line.trim());
        if (heading) {
          current = { date: heading[1].trim(), concept: null, result: null };
          blocks.push(current);
          continue;
        }
        if (current === null) continue;
        const field = /^(Concept|Result):\s*(.*)$/i.exec(line.trim());
        if (!field) continue;
        if (field[1].toLowerCase() === 'concept') current.concept = field[2].trim() || null;
        else current.result = field[2].trim() || null;
      }
      return blocks.filter((block) => block.concept !== null || block.result !== null);
    }

    function buildSnapshot(topic, graphText, stateText, logText) {
      const graph = parseGraph(graphText);
      const state = parseState(stateText);
      const log = parseLog(logText);
      const chapterTitle = (chapter) => graph.chapters.get(chapter) ?? graph.book ?? graph.topic ?? topic;

      const concepts = graph.concepts
        .map((concept) => {
          const row = state.states.get(concept.name) ?? { state: 'new', date: null };
          return { ...concept, ...row, chapterTitle: chapterTitle(concept.chapter) };
        })
        .sort((left, right) => left.chapter - right.chapter
          || left.section - right.section
          || left.order - right.order);
      concepts.forEach((concept, position) => { concept.position = position; });

      const skipped = concepts.filter((concept) => concept.state === 'skipped').length;
      const fluent = concepts.filter((concept) => concept.state === 'fluent').length;
      const denominator = concepts.length - skipped;
      const percentage = denominator > 0 ? Math.floor((fluent / denominator) * 100) : null;

      const current = concepts
        .filter((concept) => concept.date !== null)
        .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null;
      const previous = current === null ? null : concepts[current.position - 1] ?? null;
      const remaining = current === null ? concepts : concepts.slice(current.position + 1);
      const next = remaining.find((concept) => concept.state !== 'fluent' && concept.state !== 'skipped') ?? null;
      const nextState = next !== null
        ? 'concept'
        : remaining.some((concept) => concept.state === 'skipped') ? 'all-skipped' : 'end';

      const shaky = concepts
        .filter((concept) => concept.state === 'shaky')
        .sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''));

      return {
        topic,
        bookTitle: graph.book ?? graph.topic ?? topic,
        total: concepts.length,
        skipped,
        fluent,
        denominator,
        percentage,
        concepts,
        current,
        previous,
        next,
        nextState,
        shaky,
        shakyTotal: shaky.length,
        cycles: log.slice(-3).reverse().map((block) => ({
          date: block.date,
          label: block.result ?? block.concept ?? '',
        })),
        malformed: graph.malformed + state.malformed,
      };
    }

    // --- Tracker reads -------------------------------------------------------

    async function readText(files, sessionId, path) {
      const result = await files.read(sessionId, path, {});
      if (result.ok) return result.value?.text ?? '';
      // A missing file is an empty input, not a failure.
      if (result.error?.code === 'workspace-file/not-found') return '';
      throw new Error(result.error?.message ?? `${path} could not be read`);
    }

    async function loadTopic(files, sessionId, topic, stateText) {
      const base = `${TRACKER_ROOT}/${topic}`;
      const [state, graph, log] = await Promise.all([
        stateText === undefined ? readText(files, sessionId, `${base}/state.md`) : stateText,
        readText(files, sessionId, `${base}/graph.md`),
        readText(files, sessionId, `${base}/log.md`),
      ]);
      const snapshot = buildSnapshot(topic, graph, state, log);
      return snapshot.total === 0 ? { status: 'empty', topic } : { status: 'ready', snapshot };
    }

    // Both tabs open on the shared Course, then on the first Course by name.
    async function discoverTopics(files, sessionId) {
      const listing = await files.list(sessionId, TRACKER_ROOT);
      if (!listing.ok) {
        if (listing.error?.code === 'workspace-file/not-found') return { topics: [], content: { status: 'empty' } };
        throw new Error(listing.error?.message ?? 'the Course folder could not be read');
      }
      const topics = (listing.value?.entries ?? [])
        .filter((entry) => entry.type === 'directory')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
      if (topics.length === 0) return { topics, content: { status: 'empty' } };
      return { topics, content: await loadTopic(files, sessionId, pickCourse(topics)) };
    }

    // --- Study view ----------------------------------------------------------

    const conceptLabel = (concept) => `${concept.chapterTitle} · Section ${concept.section} · ${concept.name}`;

    function progressBlock(snapshot) {
      if (snapshot.percentage === null) {
        return React.createElement('div', { 'data-study-progress': 'none', style: panelProgressStyle },
          React.createElement('p', { style: panelFigureStyle }, DASH),
          React.createElement('p', { style: panelMutedStyle }, 'Every Concept is skipped.'));
      }
      const text = `${snapshot.percentage}% of the Book`;
      return React.createElement('div', { style: panelProgressStyle },
        React.createElement('p', { style: panelFigureRowStyle },
          React.createElement('span', { style: panelFigureStyle }, `${snapshot.percentage}%`),
          ' ',
          React.createElement('span', { style: panelFigureUnitStyle }, 'of the Book')),
        React.createElement('div', {
          role: 'progressbar',
          'aria-label': 'Book progress',
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': snapshot.percentage,
          'aria-valuetext': text,
          style: panelTrackStyle,
        }, React.createElement('div', {
          style: { ...panelFillStyle, width: `${snapshot.percentage}%` },
        })),
        snapshot.current === null
          ? React.createElement('p', { style: panelMutedStyle }, 'No evidence yet')
          : null);
    }

    function stripBlock(snapshot) {
      const slots = [
        { label: 'Previous', value: snapshot.previous === null ? DASH : conceptLabel(snapshot.previous), muted: snapshot.previous === null },
        { label: 'Current', value: snapshot.current === null ? 'No lesson recorded yet' : conceptLabel(snapshot.current), muted: snapshot.current === null, current: true },
        {
          label: 'Next',
          value: snapshot.next !== null
            ? conceptLabel(snapshot.next)
            : snapshot.nextState === 'all-skipped' ? 'Everything left is skipped' : 'End of Book',
          muted: snapshot.next === null,
        },
      ];
      return React.createElement('dl', { style: panelStripStyle },
        ...slots.map((slot) => React.createElement('div', {
          key: slot.label,
          style: slot.current ? panelStripCellCurrentStyle : panelStripCellStyle,
        },
          React.createElement('dt', { style: panelStripLabelStyle }, slot.label),
          React.createElement('dd', {
            style: slot.muted ? panelStripMutedValueStyle : panelStripValueStyle,
          }, slot.value))));
    }

    function topicPicker(topics, value, onTopic) {
      if (topics.length < 2) return null;
      return React.createElement('label', { style: panelFieldStyle },
        React.createElement('span', null, 'Course'),
        React.createElement('select', {
          'aria-label': 'Course',
          value,
          onChange: (event) => onTopic(event.target.value),
          style: panelSelectStyle,
        }, ...topics.map((topic) => React.createElement('option', { key: topic, value: topic }, topic))));
    }

    function readyBody(snapshot, error, topics, onTopic) {
      const nodes = [
        React.createElement('div', { style: panelHeaderStyle },
          React.createElement('h2', { style: panelTitleStyle }, snapshot.bookTitle),
          topicPicker(topics, snapshot.topic, onTopic)),
      ];
      if (error) {
        nodes.push(React.createElement('p', { role: 'alert', style: panelMutedStyle },
          `The Course could not be read: ${error}.`));
      }
      nodes.push(progressBlock(snapshot), stripBlock(snapshot));

      const shown = snapshot.shaky.slice(0, 5);
      nodes.push(React.createElement('section', { 'data-study-section': 'shaky', style: panelSectionStyle },
        React.createElement('h3', { style: panelHeadingStyle }, 'Shaky Concepts'),
        shown.length === 0
          ? React.createElement('p', { style: panelMutedStyle }, 'No shaky Concepts.')
          : React.createElement('ul', { style: panelListStyle },
              ...shown.map((concept) => React.createElement('li', { key: concept.name }, conceptLabel(concept)))),
        snapshot.shakyTotal > shown.length
          ? React.createElement('p', { style: panelMutedStyle }, `${snapshot.shakyTotal - shown.length} more not shown.`)
          : null));

      nodes.push(React.createElement('section', { 'data-study-section': 'cycles', style: panelSectionStyle },
        React.createElement('h3', { style: panelHeadingStyle }, 'Recent cycles'),
        snapshot.cycles.length === 0
          ? React.createElement('p', { style: panelMutedStyle }, 'No cycles yet.')
          : React.createElement('ul', { style: panelListStyle },
              ...snapshot.cycles.map((cycle, index) => React.createElement('li', { key: `${cycle.date}-${index}` },
                `${cycle.date} · ${cycle.label}`)))));

      if (snapshot.malformed > 0) {
        nodes.push(React.createElement('p', { role: 'status', style: panelMutedStyle },
          `${snapshot.malformed} malformed ${snapshot.malformed === 1 ? 'row was' : 'rows were'} ignored.`));
      }
      return nodes;
    }

    function StudyView({ sessionId, workspaceFiles }) {
      const [topics, setTopics] = React.useState([]);
      const [selected, setSelected] = React.useState(null);
      const [content, setContent] = React.useState({ status: 'loading' });
      // Read on every render so a selection made in the Lectures tab wins.
      const shared = activeCourse;

      React.useEffect(() => {
        let live = true;
        const run = async () => {
          try {
            const found = await discoverTopics(workspaceFiles, sessionId);
            if (!live) return;
            setTopics(found.topics);
            setContent(found.content);
          } catch (error) {
            if (!live) return;
            const message = error?.message ?? 'the Course could not be read';
            // Keep the last good snapshot so a failed reload does not blank the page.
            setContent((previous) => previous.status === 'ready' || previous.status === 'empty'
              ? { ...previous, error: message }
              : { status: 'failed', error: message });
          }
        };
        run();
        return () => { live = false; };
      }, [selected, shared, sessionId, workspaceFiles]);

      const choose = (topic) => {
        activeCourse = topic;
        setSelected(topic);
      };

      let nodes;
      if (content.status === 'loading') {
        nodes = [React.createElement('p', { role: 'status', 'aria-busy': true, style: panelMutedStyle }, 'Loading the Course…')];
      } else if (content.status === 'failed') {
        nodes = [React.createElement('p', { role: 'alert', style: panelMutedStyle }, `The Course could not be read: ${content.error}.`)];
      } else if (content.status === 'empty') {
        const searched = content.topic ? `${TRACKER_ROOT}/${content.topic}` : `${TRACKER_ROOT}/`;
        const picker = topicPicker(topics, content.topic ?? selected, choose);
        nodes = [
          picker === null ? null : React.createElement('div', { style: panelHeaderStyle }, picker),
          React.createElement('p', { style: panelMutedStyle }, `No Course in ${searched}. Run /study-plus to create one.`),
        ];
      } else {
        nodes = readyBody(content.snapshot, content.error, topics, choose);
      }
      return React.createElement('div', {
        role: 'region',
        'aria-label': VIEW_LABEL,
        style: panelStyle,
      }, ...nodes);
    }

    const panelStyle = {
      boxSizing: 'border-box',
      color: 'var(--dsw-alias-label-primary)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--dsw-font-family, inherit)',
      gap: 28,
      maxWidth: 720,
      // The conversation view area carries no padding of its own.
      padding: '24px 16px 40px',
      width: '100%',
    };
    const panelHeaderStyle = { alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' };
    const panelTitleStyle = { fontSize: 16, fontWeight: 600, lineHeight: '24px', margin: 0 };
    const panelMutedStyle = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: '20px', margin: 0 };
    const panelHeadingStyle = { fontSize: 14, fontWeight: 600, lineHeight: '22px', margin: 0 };
    const panelSectionStyle = { display: 'flex', flexDirection: 'column', gap: 10 };
    const panelListStyle = { display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', margin: 0, padding: 0 };
    const panelProgressStyle = { display: 'flex', flexDirection: 'column', gap: 10 };
    const panelFigureRowStyle = { lineHeight: '34px', margin: 0 };
    const panelFigureUnitStyle = {
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: 13,
      lineHeight: '20px',
      marginLeft: 2,
    };
    const panelTrackStyle = {
      background: 'var(--dsw-alias-border-l3)',
      borderRadius: 999,
      height: 8,
      overflow: 'hidden',
      width: '100%',
    };
    const panelFillStyle = { background: 'var(--dsw-alias-state-business-primary)', height: '100%' };
    const panelStripStyle = {
      alignItems: 'start',
      display: 'grid',
      gap: 12,
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      margin: 0,
    };
    const panelStripCellStyle = {
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 'var(--dsw-radius-sm)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '12px 14px',
    };
    // The Current cell is the answer to "where am I", so it is the only filled cell.
    const panelStripCellCurrentStyle = {
      ...panelStripCellStyle,
      background: 'var(--dsw-alias-bg-layer-1)',
      borderColor: 'var(--dsw-alias-border-l3)',
    };
    const panelStripLabelStyle = { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, lineHeight: '18px', margin: 0 };
    const panelStripValueStyle = { fontSize: 13, lineHeight: '20px', margin: 0 };
    const panelStripMutedValueStyle = {
      ...panelStripValueStyle,
      color: 'var(--dsw-alias-label-tertiary)',
    };
    const panelFigureStyle = {
      fontSize: 28,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      lineHeight: '34px',
      margin: 0,
    };
    const panelFieldStyle = { alignItems: 'center', display: 'flex', fontSize: 13, gap: 8 };
    const panelSelectStyle = {
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l3)',
      borderRadius: 'var(--dsw-radius-sm, 6px)',
      color: 'var(--dsw-alias-label-primary)',
      font: 'inherit',
      height: 32,
      padding: '0 8px',
    };

    // --- Lectures dock page --------------------------------------------------
    const LECTURES_ID = 'dsh-nerd-mode/lectures';
    const LECTURES_KIND = 'lectures';
    const LECTURES_LABEL = 'Lectures';
    const LECTURES_GUIDE_ORDER = 40;

    // Same 16px book as the composer pill, drawn at the size the guide asks for.
    function LecturesGlyph({ size = 16 }) {
      return React.createElement(
        'svg',
        {
          'aria-hidden': 'true',
          fill: 'none',
          height: size,
          stroke: 'currentColor',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeWidth: 1.6,
          viewBox: '0 0 16 16',
          width: size,
        },
        ...BOOK.props.children,
      );
    }

    // The leading block only; a `---` rule later in the file stays content.
    // A block without a closing fence, or with a line that is not `key: value`,
    // returns null so the caller can leave the state empty.
    function lectureFrontmatter(lines) {
      if (lines[0]?.trim() !== '---') return {};
      const end = lines.findIndex((line, at) => at > 0 && line.trim() === '---');
      if (end === -1) return null;
      const fields = {};
      for (const line of lines.slice(1, end)) {
        if (line.trim() === '') continue;
        const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line.trim());
        if (match === null) return null;
        fields[match[1]] = match[2].trim();
      }
      return fields;
    }

    function parseLecture(text, slug) {
      const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
      const fields = lectureFrontmatter(lines);
      const heading = lines.find((line) => /^#\s+\S/.test(line));
      const draft = fields !== null && fields.status === 'draft';
      const date = fields !== null && /^\d{4}-\d{2}-\d{2}$/.test(fields.date ?? '') ? fields.date : null;
      // A draft that also carries a teaching date is malformed, so the block reads as unparsable.
      const valid = fields !== null && !(draft && date !== null);
      return {
        title: heading === undefined ? slug : heading.replace(/^#\s+/, '').trim(),
        concept: valid && /^\d+$/.test(fields.concept ?? '') ? Number(fields.concept) : null,
        date: valid ? date : null,
        draft: valid && draft,
      };
    }

    // A missing folder is an empty listing. Any other failure becomes data.
    // `found` tells the caller whether the folder exists, so a missing root and
    // an empty root can render different pages.
    async function listFolder(files, sessionId, path) {
      try {
        const listing = await files.list(sessionId, path);
        if (listing.ok) return { entries: listing.value?.entries ?? [], error: null, found: true };
        if (listing.error?.code === 'workspace-file/not-found') return { entries: [], error: null, found: false };
        return { entries: [], error: listing.error?.message ?? `${path} could not be read`, found: false };
      } catch (error) {
        return { entries: [], error: error?.message ?? `${path} could not be read`, found: false };
      }
    }

    /** Return `{ courses, course, entries, error, rootFound }`. `rootFound` is false only when `study/` is missing, `course` is null when the workspace holds none, and `error` is the first read failure or null. */
    async function loadLectures(files, sessionId) {
      const model = { courses: [], course: null, entries: [], error: null, rootFound: false };
      const root = await listFolder(files, sessionId, TRACKER_ROOT);
      model.rootFound = root.found;
      if (root.error !== null) {
        model.error = root.error;
        return model;
      }
      model.courses = root.entries
        .filter((entry) => entry.type === 'directory')
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
      model.course = pickCourse(model.courses);
      if (model.course === null) return model;
      const entries = [];
      const seen = new Set();
      const folders = [
        [`${TRACKER_ROOT}/${model.course}/lectures`, false],
        [`${TRACKER_ROOT}/${model.course}/lectures/archive`, true],
      ];
      for (const [folder, archived] of folders) {
        const listing = await listFolder(files, sessionId, folder);
        if (listing.error !== null && model.error === null) model.error = listing.error;
        for (const item of listing.entries) {
          if (item.type !== 'file') continue;
          const match = /^(\d{2,})-(.+)\.md$/.exec(item.name);
          // One lecture per number: a stale copy in the archive never repeats it.
          if (match === null || seen.has(match[1])) continue;
          let text;
          try {
            text = await readText(files, sessionId, `${folder}/${item.name}`);
          } catch (error) {
            if (model.error === null) model.error = error?.message ?? `${folder}/${item.name} could not be read`;
            continue;
          }
          const parsed = parseLecture(text, match[2]);
          entries.push({
            number: match[1],
            topic: model.course,
            title: parsed.title,
            concept: parsed.concept,
            mark: archived ? 'archived' : parsed.draft ? 'draft' : parsed.date !== null ? 'dated' : null,
            date: parsed.date,
            path: `${folder}/${item.name}`,
          });
          seen.add(match[1]);
        }
      }
      entries.sort((left, right) => Number(left.number) - Number(right.number));
      model.entries = entries;
      return model;
    }

    // The picker and Course name stay in view while only the lecture rows
    // scroll. The scroller owns the side padding, so its bar sits at the page
    // edge rather than inside the text.
    const LECTURES_CSS = `.lectures-page{box-sizing:border-box;height:100%;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family,inherit)}
.lectures-head{display:flex;align-items:center;gap:12px;padding:24px 32px 0}
.lectures-picker{display:flex;align-items:center;gap:8px;flex:1;min-width:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.lectures-select{flex:1;min-width:0;height:32px;padding:0 8px;border:1px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
.lectures-group{display:flex;flex-direction:column;flex:1;min-height:0}
.lectures-group-head{display:flex;align-items:center;gap:8px;padding:20px 32px 8px}
.lectures-group-title{margin:0;font-size:14px;line-height:22px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lectures-count{flex:none;font-size:13px;line-height:20px;font-weight:400;color:var(--dsw-alias-label-tertiary)}
.lectures-scroll{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:0 32px 32px}
.lectures-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.lectures-item{margin:0 -8px}
.lectures-row{position:relative;width:100%;box-sizing:border-box;display:grid;grid-template-columns:28px minmax(0,1fr);grid-template-areas:"tile title" "tile meta";column-gap:12px;row-gap:2px;align-items:start;padding:8px;border:none;border-radius:var(--dsw-radius-xl,20px);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:normal}
.lectures-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.lectures-row:focus-visible{outline:none}
.lectures-row:focus-visible::after{content:"";position:absolute;inset:0;border-radius:inherit;outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.lectures-tile{grid-area:tile;align-self:center;width:28px;height:28px;display:grid;place-items:center;border-radius:6px;background:var(--dsw-alias-fill-tsp-secondary);color:var(--dsw-alias-label-secondary);font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.lectures-title{grid-area:title;font-size:14px;line-height:20px;font-weight:500;overflow-wrap:anywhere}
.lectures-meta{grid-area:meta;display:flex;align-items:center;gap:6px;min-width:0;font-size:13px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.lectures-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;font-size:11px;line-height:17px;border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.lectures-fold{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;margin-top:12px;padding:0;border:none;background:none;font-size:14px;line-height:22px;font-weight:500;color:var(--dsw-alias-label-primary);cursor:pointer}
.lectures-fold:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.lectures-chev{color:var(--dsw-alias-label-tertiary);transition:transform 120ms}
.lectures-fold[aria-expanded="false"] .lectures-chev{transform:rotate(-90deg)}
.lectures-status{margin:0;padding:8px 32px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.lectures-error{display:flex;align-items:center;gap:8px;margin:0;padding:8px 32px;font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary)}
.lectures-dot{flex:none;width:6px;height:6px;border-radius:50%;background:currentColor}
.lectures-empty{margin:0;padding:48px 20px;text-align:center;font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary)}
.lectures-empty code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:1px 6px}`;

    const LECTURE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // `2026-10-28` reads as `28 Oct 2026`: shorter than the ISO form and still one date.
    function lectureDate(value) {
      const [year, month, day] = value.split('-');
      const name = LECTURE_MONTHS[Number(month) - 1];
      return name === undefined ? value : `${Number(day)} ${name} ${year}`;
    }

    function lectureMark(entry) {
      if (entry.mark === 'archived') return 'Archived';
      if (entry.mark === 'draft') return 'Draft';
      if (entry.mark === 'dated' && entry.date !== null) return lectureDate(entry.date);
      return null;
    }

    // Copied verbatim from `@deepseek-ai/dsh-util-workspace-path`, which a client
    // plugin cannot load from the browser module table.
    const FILE_ADDRESS_PREFIX = 'dsh-resource://file/';
    /** Component-encode one id or path segment, keeping `:` literal for drive letters. */
    function encodeSegment(segment) {
      return encodeURIComponent(segment).replace(/%3A/gi, ':');
    }
    /** Encode a `/`-separated path segment by segment. */
    function encodePath(path) {
      return path.split('/').map(encodeSegment).join('/');
    }
    /** Build the address of a file read through one Session. */
    function sessionFileAddress(sessionId, path) {
      const normalized = path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '');
      return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
    }

    // The visible title is clipped, so the label repeats it in full.
    function lectureRow(entry, onOpen) {
      const mark = lectureMark(entry);
      const label = mark === null
        ? `${entry.number}, ${entry.title}`
        : `${entry.number}, ${entry.title}, ${mark}`;
      return React.createElement('li', { key: entry.number, className: 'lectures-item' },
        React.createElement('button', {
          type: 'button',
          className: 'lectures-row',
          'aria-label': label,
          onClick: () => onOpen(entry),
        },
        React.createElement('span', { className: 'lectures-tile', 'aria-hidden': 'true' }, entry.number),
        React.createElement('span', { className: 'lectures-title' }, entry.title),
        mark === null
          ? null
          : React.createElement('span', { className: 'lectures-meta' },
              entry.mark === 'dated'
                ? mark
                : React.createElement('span', { className: 'lectures-chip' }, mark))));
    }

    function lectureTopic(group, open, onToggle, onOpen) {
      const main = group.entries.filter((entry) => entry.mark !== 'archived');
      const archived = group.entries.filter((entry) => entry.mark === 'archived');
      const archiveId = `lectures-archive-${group.topic}`;
      const rows = [];
      if (group.entries.length === 0) {
        rows.push(React.createElement('p', { key: 'empty', className: 'lectures-empty' }, 'No lectures yet.'));
      } else if (main.length > 0) {
        rows.push(React.createElement('ul', { key: 'main', className: 'lectures-rows' }, ...main.map((entry) => lectureRow(entry, onOpen))));
      }
      if (archived.length > 0) {
        rows.push(React.createElement('button', {
          key: 'fold',
          type: 'button',
          className: 'lectures-fold',
          'aria-expanded': open,
          // A closed fold has no list to control, so the reference would dangle.
          'aria-controls': open ? archiveId : undefined,
          'aria-label': `Archived lectures ${archived.length}`,
          onClick: () => onToggle(group.topic),
        },
        React.createElement('span', null, 'Archived lectures'),
        React.createElement('span', { className: 'lectures-count' }, String(archived.length)),
        React.createElement('svg', {
          'aria-hidden': 'true',
          className: 'lectures-chev',
          fill: 'none',
          height: 12,
          stroke: 'currentColor',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeWidth: 1.6,
          viewBox: '0 0 16 16',
          width: 12,
        }, React.createElement('path', { d: 'M3.5 6 8 10.5 12.5 6' }))));
        if (open) {
          rows.push(React.createElement('ul', { key: 'archive', className: 'lectures-rows', id: archiveId }, ...archived.map((entry) => lectureRow(entry, onOpen))));
        }
      }
      // The Course key remounts the section on a switch, so its scrollport starts at the top.
      return React.createElement('section', { key: group.topic, className: 'lectures-group' },
        React.createElement('div', { className: 'lectures-group-head' },
          React.createElement('h2', { className: 'lectures-group-title' }, group.topic),
          React.createElement('span', { className: 'lectures-count' }, String(main.length))),
        React.createElement('div', { className: 'lectures-scroll' }, ...rows));
    }

    function LecturesPage({ useTabInfo, sessionId, workspaceFiles }) {
      const { tab } = useTabInfo();
      const [content, setContent] = React.useState({ status: 'loading' });
      const [selected, setSelected] = React.useState(null);
      const [foldOpen, setFoldOpen] = React.useState(false);
      // Read on every render so a selection made in the Study tab wins.
      const shared = activeCourse;

      React.useEffect(() => {
        let live = true;
        const run = async () => {
          const model = await loadLectures(workspaceFiles, sessionId);
          if (!live) return;
          setContent({ status: 'ready', ...model });
        };
        run();
        return () => { live = false; };
      }, [selected, shared, sessionId, workspaceFiles]);

      const choose = (course) => {
        activeCourse = course;
        setFoldOpen(false);
        setSelected(course);
      };

      // No placement option: the preview opens as a tab in this pane and the
      // host focuses it when that lecture is already open.
      const open = (entry) => tab.actions.openResource(sessionFileAddress(sessionId, entry.path));

      let nodes;
      if (content.status === 'loading') {
        nodes = [React.createElement('p', { role: 'status', 'aria-busy': true, className: 'lectures-status' }, 'Loading the lectures…')];
      } else if (content.error === null && !content.rootFound) {
        nodes = [React.createElement('p', { className: 'lectures-empty' },
          `No Course in ${TRACKER_ROOT}/. Run `,
          React.createElement('code', null, '/study-plus'),
          ' to create one.')];
      } else {
        nodes = content.error === null
          ? []
          : [React.createElement('p', { role: 'alert', className: 'lectures-error' },
              React.createElement('span', { className: 'lectures-dot', 'aria-hidden': 'true' }),
              `The lecture library could not be read: ${content.error}.`)];
        if (content.course !== null) {
          nodes.push(lectureTopic(
            { topic: content.course, entries: content.entries },
            foldOpen,
            () => setFoldOpen((previous) => !previous),
            open,
          ));
        }
      }

      // One Course needs no picker: the page already shows that Course.
      const courses = content.courses ?? [];
      const picker = courses.length < 2 ? null : React.createElement('label', { className: 'lectures-picker' },
        React.createElement('span', null, 'Course'),
        React.createElement('select', {
          'aria-label': 'Course',
          className: 'lectures-select',
          value: content.course ?? selected,
          onChange: (event) => choose(event.target.value),
        }, ...courses.map((course) => React.createElement('option', { key: course, value: course }, course))));
      return React.createElement('div', {
        role: 'region',
        'aria-label': LECTURES_LABEL,
        className: 'lectures-page',
      }, React.createElement('style', null, LECTURES_CSS),
      React.createElement('header', { className: 'lectures-head' }, picker),
      ...nodes);
    }

    // A page type names no resource pattern and no `multiple`, so the host
    // records it at one fixed page address and a reopen focuses that tab.
    const LECTURES_DEFINITION = {
      id: LECTURES_ID,
      kind: LECTURES_KIND,
      title: () => LECTURES_LABEL,
      guide: [{
        id: 'lectures',
        order: LECTURES_GUIDE_ORDER,
        title: () => LECTURES_LABEL,
        description: () => 'Read the lectures saved in this workspace.',
        icon: LecturesGlyph,
      }],
    };

    // --- Study Sessions panel ------------------------------------------------

    const STUDY_SESSIONS_ID = 'study-sessions';
    const STUDY_SESSIONS_ORDER = 30;
    const STUDY_SESSIONS_API = '/dsh-nerd-mode/api/study-sessions';
    const STUDY_SESSIONS_TITLE = { en: 'Study Sessions', zh: '学习会话' };
    const STUDY_QUICK = { en: 'Quick', zh: '快速' };
    const STUDY_IN_DEPTH = { en: 'In-depth', zh: '深入' };
    const STUDY_PAST = { en: 'Past', zh: '过去' };

    // A host without the session package still gets the page and its empty line.
    const NO_SESSIONS_HOOK = () => null;

    // A failed rescan or a remount must not blank the panel, so the last good scan outlives the component.
    let studySessionsCache = null;

    /**
     * Read one history chunk from the host route.
     *
     * Returns `{ phase, done, total, sessions, cursor }`. Throws an Error whose message names the failure:
     * a missing route (404/405 or a body that is not JSON) and any non-OK reply both count.
     */
    async function readSessionChunk(cursor) {
      const response = await fetch(`${STUDY_SESSIONS_API}?cursor=${cursor}`);
      // The static fallback owns an unregistered path, so it answers with an empty body.
      if (response.status === 404 || response.status === 405) throw new Error('the host route is not available');
      // A rejected request carries plain text, so name the status before the body is parsed.
      if (response.status === 401 || response.status === 403) {
        throw new Error(`the host denied the request (HTTP ${response.status})`);
      }
      const body = await response.json().catch(() => null);
      if (body === null) throw new Error('the host returned no JSON');
      if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
      const sessions = body?.sessions;
      if (typeof sessions !== 'object' || sessions === null) throw new Error('the host returned no session history');
      return {
        phase: body.phase === 'ready' ? 'ready' : 'scanning',
        done: Number.isFinite(body.done) ? body.done : 0,
        total: Number.isFinite(body.total) ? body.total : 0,
        sessions,
        // The spec names no cursor field, so accept one or fall back to the processed count.
        cursor: Number.isFinite(body.cursor) ? body.cursor : Number.isFinite(body.done) ? body.done : cursor,
      };
    }

    /**
     * Scan the host history index from cursor 0, merging each chunk into `sessions`.
     *
     * Calls `onChunk` after every reply so the page can move its progress line. Returns the final
     * scan state. A host that repeats a cursor cannot make progress, so the loop stops there.
     */
    async function scanSessionHistory(sessions, onChunk) {
      let state = { status: 'scanning', sessions, done: 0, total: 0, cursor: 0 };
      let previous = 0;
      for (;;) {
        const chunk = await readSessionChunk(state.cursor);
        state = {
          status: chunk.phase,
          // A ready reply carries the host's whole index, so it replaces stale cached ids.
          sessions: chunk.phase === 'ready' ? chunk.sessions : { ...state.sessions, ...chunk.sessions },
          done: chunk.done,
          total: chunk.total,
          cursor: chunk.cursor,
        };
        onChunk(state);
        if (state.status === 'ready' || chunk.cursor <= previous) return state;
        previous = chunk.cursor;
      }
    }

    /** Return the last folder in a workspace path; Windows and POSIX separators both count. */
    function workspaceName(cwd) {
      if (typeof cwd !== 'string') return '';
      return cwd.split(/[\\/]+/).filter((part) => part !== '').pop() ?? '';
    }

    const RELATIVE_UNITS = [
      ['year', 31536000000],
      ['month', 2592000000],
      ['day', 86400000],
      ['hour', 3600000],
      ['minute', 60000],
      ['second', 1000],
    ];

    /** Return a locale-aware relative time such as `2 hours ago`; a missing time reads as an empty string. */
    function relativeTime(updatedAt, language) {
      if (!Number.isFinite(updatedAt)) return '';
      const elapsed = updatedAt - Date.now();
      const [unit, size] = RELATIVE_UNITS.find(([, step]) => Math.abs(elapsed) >= step) ?? RELATIVE_UNITS[5];
      return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(Math.round(elapsed / size), unit);
    }

    /** Join the live session list with the history index. A history id with no live row is dropped. */
    function sessionRows(snapshot, history) {
      const ids = Array.isArray(snapshot?.ids) ? snapshot.ids : [];
      const byId = snapshot?.byId ?? {};
      const rows = [];
      for (const id of ids) {
        const row = byId[id];
        if (row === undefined || !Object.hasOwn(history, id)) continue;
        rows.push({
          id,
          title: String(row.displayTitle ?? id),
          workspace: workspaceName(row.cwd),
          updatedAt: Number.isFinite(row.updatedAt) ? row.updatedAt : 0,
          active: row.projectionValues?.studyMode?.active === true,
          studyPlus: history[id]?.studyPlus === true,
        });
      }
      return rows.sort((left, right) => right.updatedAt - left.updatedAt);
    }

    /** Split rows into Quick, In-depth, and Past; a missing live switch value counts as off. */
    function groupSessionRows(rows) {
      const groups = { quick: [], inDepth: [], past: [] };
      for (const row of rows) {
        if (!row.active) groups.past.push(row);
        else if (row.studyPlus) groups.inDepth.push(row);
        else groups.quick.push(row);
      }
      return groups;
    }

    // The tile is decoration; the group heading and the row label carry the meaning.
    function studyTile(kind) {
      const glyph = (children) => React.createElement('svg', {
        fill: 'none',
        height: 16,
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: 1.6,
        viewBox: '0 0 16 16',
        width: 16,
      }, ...children);
      if (kind === 'book') return glyph(BOOK.props.children);
      if (kind === 'quick') {
        return glyph([
          React.createElement('path', { d: 'M13.4 8.9a3.7 3.7 0 0 1-3.7 3.7H6.4L3.4 14.6v-2.5A3.7 3.7 0 0 1 1.8 9V7.5a3.7 3.7 0 0 1 3.7-3.7h4.2a3.7 3.7 0 0 1 3.7 3.7Z' }),
          React.createElement('path', { d: 'M5.2 7.3h5.6M5.2 9.3h3.4' }),
        ]);
      }
      return glyph([
        React.createElement('circle', { cx: 8, cy: 8, r: 5.6 }),
        React.createElement('path', { d: 'M8 5.2V8l1.9 1.3' }),
      ]);
    }

    // Inline because the client bundle cannot read assets/.
    function StudySessionsIcon({ size = 16, active = false }) {
      return React.createElement(
        'svg',
        {
          'aria-hidden': 'true',
          fill: 'none',
          height: size,
          stroke: 'currentColor',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeWidth: active ? 2 : 1.6,
          viewBox: '0 0 16 16',
          width: size,
        },
        React.createElement('path', { d: 'M2.5 4h11M2.5 8h11M2.5 12h7' }),
        React.createElement('circle', {
          cx: 12.5,
          cy: 12,
          fill: 'currentColor',
          opacity: active ? 1 : 0.45,
          r: 1.2,
          stroke: 'none',
        }),
      );
    }

    function StudySessionsPage({ useSessions, locale, openSession }) {
      const t = useT(locale);
      const language = locale.getSnapshot()?.active ?? 'en';
      const [scan, setScan] = React.useState(() => studySessionsCache === null
        ? { status: 'scanning', sessions: {}, done: 0, total: 0, cursor: 0 }
        : { ...studySessionsCache, status: 'scanning' });
      // Only a folded key reads true: In-depth and Quick start open, Past starts folded.
      const [folded, setFolded] = React.useState({ inDepth: false, quick: false, past: true });
      const snapshot = useSessions((state) => state);

      React.useEffect(() => {
        let live = true;
        // A cached list seeds the scan, so rows stay while the host rescans.
        scanSessionHistory(studySessionsCache?.sessions ?? {}, (chunk) => {
          if (!live) return;
          studySessionsCache = chunk;
          setScan(chunk);
        }).catch((error) => {
          if (!live) return;
          setScan((previous) => ({
            ...previous,
            status: 'failed',
            reason: error?.message ?? 'the host did not answer',
          }));
        });
        return () => { live = false; };
      }, []);

      const grouped = groupSessionRows(sessionRows(snapshot, scan.sessions));

      // The row is one target, so its label names the title, workspace, time, and mode.
      const rowNode = (row, past) => {
        const time = relativeTime(row.updatedAt, language);
        const chip = past ? t(row.studyPlus ? STUDY_IN_DEPTH : STUDY_QUICK) : null;
        const label = [row.title, row.workspace, time, chip]
          .filter((part) => part !== '' && part !== null)
          .join(', ');
        return React.createElement('li', { className: 'study-ss-item', key: row.id },
          React.createElement('button', {
            type: 'button',
            className: 'study-ss-row',
            'aria-label': label,
            onClick: () => openSession(row.id),
          },
          React.createElement('span', { className: 'study-ss-tile', 'aria-hidden': 'true' },
            studyTile(past ? 'past' : row.studyPlus ? 'book' : 'quick')),
          React.createElement('span', { className: 'study-ss-title' }, row.title),
          React.createElement('span', { className: 'study-ss-meta' },
            row.workspace === '' ? null : React.createElement('span', { className: 'study-ss-workspace' }, row.workspace),
            chip === null ? null : React.createElement('span', {
              className: 'study-ss-chip',
              'data-study-chip': '',
            }, chip)),
          time === '' ? null : React.createElement('span', { className: 'study-ss-time' }, time)));
      };

      const nodes = [];
      if (scan.status === 'scanning') {
        const percent = scan.total > 0 ? Math.round((scan.done / scan.total) * 100) : 0;
        nodes.push(React.createElement('div', { key: 'progress', className: 'study-ss-scan' },
          React.createElement('p', {
            role: 'status',
            'aria-busy': true,
            className: 'study-ss-status',
          }, t({
            en: `Scanning session history… ${scan.done} of ${scan.total}`,
            zh: `正在扫描会话历史… ${scan.done} / ${scan.total}`,
          })),
          React.createElement('div', { className: 'study-ss-track', 'aria-hidden': 'true' },
            React.createElement('div', { className: 'study-ss-fill', style: { width: `${percent}%` } }))));
      }
      if (scan.status === 'failed') {
        nodes.push(React.createElement('p', {
          key: 'failure',
          role: 'alert',
          className: 'study-ss-error',
        },
        React.createElement('span', { className: 'study-ss-dot', 'aria-hidden': 'true' }),
        t({
          en: `The session index could not be read: ${scan.reason}`,
          zh: `无法读取会话索引：${scan.reason}`,
        })));
      }
      if (scan.status === 'ready' && Object.keys(scan.sessions).length === 0) {
        nodes.push(React.createElement('p', { key: 'empty', className: 'study-ss-empty' },
          t({
            en: 'No study session yet. Turn on Nerd Mode from the composer bar, or run',
            zh: '还没有学习会话。在输入栏打开 Nerd Mode，或运行',
          }),
          ' ',
          React.createElement('code', null, '/nerd-mode on'),
          t({ en: '.', zh: '。' })));
      }

      const group = (key, label, list, past) => {
        if (list.length === 0) return null;
        const open = folded[key] === false;
        const listId = `study-ss-rows-${key}`;
        return React.createElement('section', { key, className: 'study-ss-group' },
          React.createElement('h2', { className: 'study-ss-group-title' },
            React.createElement('button', {
              type: 'button',
              className: 'study-ss-fold',
              'aria-expanded': open,
              // A folded group has no list to control, so the reference would dangle.
              'aria-controls': open ? listId : undefined,
              'aria-label': `${t(label)} ${list.length}`,
              onClick: () => setFolded((previous) => ({ ...previous, [key]: !previous[key] })),
            },
            React.createElement('span', null, t(label)),
            React.createElement('span', { className: 'study-ss-count' }, String(list.length)),
            React.createElement('svg', {
              'aria-hidden': 'true',
              className: 'study-ss-chev',
              fill: 'none',
              height: 12,
              stroke: 'currentColor',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 1.6,
              viewBox: '0 0 16 16',
              width: 12,
            }, React.createElement('path', { d: 'M3.5 6 8 10.5 12.5 6' })))),
          open
            ? React.createElement('ul', { className: 'study-ss-rows', id: listId },
                ...list.map((row) => rowNode(row, past)))
            : null);
      };
      nodes.push(group('inDepth', STUDY_IN_DEPTH, grouped.inDepth, false));
      nodes.push(group('quick', STUDY_QUICK, grouped.quick, false));
      nodes.push(group('past', STUDY_PAST, grouped.past, true));

      return React.createElement('div', {
        role: 'region',
        'aria-label': t(STUDY_SESSIONS_TITLE),
        className: 'study-ss-page',
      }, React.createElement('style', null, STUDY_SESSIONS_CSS),
      React.createElement('header', { className: 'study-ss-head', 'data-window-drag': '' },
        React.createElement('h1', { className: 'study-ss-title' }, t(STUDY_SESSIONS_TITLE)),
        React.createElement('p', { className: 'study-ss-intro' }, t({
          en: 'Every conversation where Nerd Mode was on.',
          zh: '开启过 Nerd Mode 的会话都在这里。',
        }))),
      ...nodes);
    }

    // The page shell, rows, and fold live in CSS so a container query can fold
    // the time under the title on narrow panes. Tokens come from the host theme.
    const STUDY_SESSIONS_CSS = `.study-ss-page{box-sizing:border-box;height:100%;overflow:auto;display:flex;flex-direction:column;align-items:center;gap:32px;padding:0 clamp(24px,4vw,48px) 48px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family,inherit);container-type:inline-size}
.study-ss-page>*{width:100%;max-width:960px}
.study-ss-head{display:flex;flex-direction:column;padding-top:28px}
[data-platform="darwin"] .study-ss-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.study-ss-title{font-size:20px;line-height:28px;font-weight:500;margin:0}
.study-ss-intro{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);margin:4px 0 0}
.study-ss-group{display:flex;flex-direction:column;gap:8px}
.study-ss-group-title{font-size:14px;line-height:22px;font-weight:500;margin:0}
.study-ss-fold{display:inline-flex;align-items:center;gap:8px;padding:0;background:none;border:none;font:inherit;color:inherit;cursor:pointer}
.study-ss-fold:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.study-ss-count{font-size:13px;line-height:20px;font-weight:400;color:var(--dsw-alias-label-tertiary)}
.study-ss-chev{color:var(--dsw-alias-label-tertiary);transition:transform 120ms}
.study-ss-fold[aria-expanded="false"] .study-ss-chev{transform:rotate(-90deg)}
.study-ss-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.study-ss-item{margin:0 -8px}
.study-ss-row{position:relative;width:100%;box-sizing:border-box;display:grid;grid-template-columns:32px minmax(0,1fr) auto;grid-template-areas:"tile title time" "tile meta time";column-gap:12px;row-gap:2px;align-items:start;padding:8px;border:none;border-radius:var(--dsw-radius-xl,20px);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:normal}
.study-ss-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.study-ss-row:focus-visible{outline:none}
.study-ss-row:focus-visible::after{content:"";position:absolute;inset:0;border-radius:inherit;outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.study-ss-tile{grid-area:tile;align-self:center;width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);color:var(--dsw-alias-state-business-primary)}
.study-ss-title{grid-area:title;font-size:14px;line-height:20px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-ss-meta{grid-area:meta;display:flex;align-items:center;gap:6px;min-width:0;font-size:13px;line-height:18px;color:var(--dsw-alias-label-tertiary);flex-wrap:wrap}
.study-ss-workspace{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-ss-time{grid-area:time;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;margin-top:2px}
.study-ss-chip{display:inline-flex;align-items:center;height:18px;padding:0 7px;font-size:11px;line-height:17px;border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
@container (max-width:520px){.study-ss-row{grid-template-areas:"tile title title" "tile meta time"}.study-ss-time{margin-top:0}}
.study-ss-scan{display:flex;flex-direction:column;gap:10px}
.study-ss-status{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);margin:0}
.study-ss-track{height:2px;background:var(--dsw-alias-border-l3);border-radius:999px;overflow:hidden}
.study-ss-fill{height:100%;background:var(--dsw-alias-state-business-primary)}
.study-ss-error{display:flex;align-items:center;gap:8px;font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary);margin:0}
.study-ss-dot{flex:none;width:6px;height:6px;border-radius:50%;background:currentColor}
.study-ss-empty{text-align:center;padding:48px 20px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary);margin:0}
.study-ss-empty code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:1px 6px}`;

    return {
      inject: ['slots', 'remote', 'remote.commands', 'remote.workspaceFiles', 'configForms'],
      apply(ctx) {
        ctx.slots.inject(SLOT, () =>
          ctx.slots.register({
            name: SLOT,
            id: 'nerd-mode',
            order: -1,
            registrant: 'dsh-nerd-mode',
            inject: (sessionId) => ({
              execute: (command) => ctx.remote.commands.execute(sessionId, command, []),
            }),
          }, NerdModeToggle),
        );
        ctx.inject(['locale'], (localeCtx) => {
          ctx.slots.inject(SETTINGS_SLOT, () =>
            ctx.slots.register({
              name: SETTINGS_SLOT,
              id: 'dsh-nerd-mode',
              order: 30,
              label: LABEL,
            }, ({ close }) => React.createElement(NerdModeSettingsEntry, {
              close,
              configForms: ctx.configForms,
              locale: localeCtx.locale,
            })),
          );
          // One id addresses both seats: the sidebar row selects the keyed main page.
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register({
              name: 'sidebar.panellist',
              id: STUDY_SESSIONS_ID,
              order: STUDY_SESSIONS_ORDER,
              // The label owns its translator: the slot's `t` prop belongs to the icon.
              label: () => localeCtx.locale.resolveText(STUDY_SESSIONS_TITLE),
            }, StudySessionsIcon),
          );
          ctx.slots.inject('main', () =>
            ctx.slots.register({
              name: 'main',
              key: STUDY_SESSIONS_ID,
              inject: () => ({
                locale: localeCtx.locale,
                openSession: (id) => {
                  try {
                    ctx.get('uiWorkspace')?.openSession(id);
                  } catch {
                    // A stale row must not take the panel down.
                  }
                },
              }),
            }, (props) => React.createElement(StudySessionsPage, {
              ...props,
              useSessions: typeof props.useSessions === 'function' ? props.useSessions : NO_SESSIONS_HOOK,
            })),
          );
        });
        ctx.slots.inject(VIEW_SLOT, () =>
          ctx.slots.register({
            name: VIEW_SLOT,
            id: VIEW_ID,
            order: VIEW_ORDER,
            label: VIEW_LABEL,
            inject: (sessionId) => ({
              sessionId,
              workspaceFiles: ctx.remote.workspaceFiles,
            }),
          }, StudyView),
        );
        // A host without the right Sidebar never provides the registry, so this
        // one seat waits. The rest of the plugin keeps working.
        ctx.inject(['sidebarRightTabs'], (dock) => {
          dock.effect(
            () => dock.sidebarRightTabs.register(LECTURES_DEFINITION),
            'dsh-nerd-mode: lectures tab type',
          );
        });
        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: LECTURES_ID,
          inject: (sessionId) => ({ sessionId, workspaceFiles: ctx.remote.workspaceFiles }),
        }, LecturesPage));
      },
    };
  },
});
