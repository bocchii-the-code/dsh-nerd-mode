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

    function NerdModeSettingsEntry({ configForms, close }) {
      const description = configForms.describe();
      const described = React.useSyncExternalStore(
        (listener) => description.subscribe(listener),
        () => description.getSnapshot(),
        () => description.getSnapshot(),
      );
      const settingsExist = described.view?.namespaces.some(({ ns }) => ns === SETTINGS_NAMESPACE) === true;
      if (!settingsExist) {
        const loading = (described.status === 'idle' || described.status === 'loading') && !described.error;
        return React.createElement('div', { 'data-nerd-mode-settings': '' },
          React.createElement('p', {
            role: 'status',
            'aria-busy': loading,
            style: feedbackStyle,
          }, loading
            ? 'Loading Nerd Mode settings…'
            : described.status === 'ready'
              ? 'Nerd Mode settings are unavailable in this profile.'
              : 'Nerd Mode settings could not be loaded. Refresh the Settings window and try again.'),
          loading ? null : React.createElement('button', {
            type: 'button',
            onClick: close,
            style: secondaryButtonStyle,
          }, 'Close'),
        );
      }
      return React.createElement(NerdModeSettings, {
        close,
        scope: configForms.get(SETTINGS_NAMESPACE),
      });
    }

    function NerdModeSettings({ scope, close }) {
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
        }, 'Loading Nerd Mode settings…');
      }
      if (snapshot?.status !== 'ready') {
        return React.createElement('div', { 'data-nerd-mode-settings': '' },
          React.createElement('p', { role: 'status', style: feedbackStyle },
            snapshot?.status === 'unavailable'
              ? 'Nerd Mode settings are unavailable in this profile.'
              : 'Nerd Mode settings could not be loaded. Refresh the Settings window and try again.'),
          React.createElement('button', {
            type: 'button',
            onClick: close,
            style: secondaryButtonStyle,
          }, 'Close'),
        );
      }
      if (draft === null) return null;
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
          if (accepted === false) throw new Error('The profile rejected these settings.');
          setDraft(settingsValues(scope.getSnapshot()));
          setFeedback('Saved to this profile. Changes apply to the next study-plus session.');
        } catch (error) {
          setFeedback(`Could not save settings: ${error?.message ?? 'the profile rejected the changes'}`);
        } finally {
          setSaving(false);
        }
      };

      return React.createElement(
        'div',
        {
          'data-nerd-mode-settings': '',
          style: {
            boxSizing: 'border-box',
            color: 'var(--dsw-alias-label-primary)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'var(--dsw-font-family, inherit)',
            gap: 16,
            maxWidth: 720,
            paddingBottom: 24,
            width: '100%',
          },
        },
        React.createElement(
          'header',
          { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          React.createElement('h2', {
            style: { fontSize: 16, fontWeight: 600, lineHeight: '24px', margin: 0 },
          }, 'Nerd Mode'),
          React.createElement('p', {
            style: {
              color: 'var(--dsw-alias-label-tertiary)',
              fontSize: 14,
              lineHeight: '22px',
              margin: 0,
            },
          }, 'Profile defaults for new study-plus sessions.'),
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
            React.createElement('h3', { style: groupTitleStyle }, 'Recall Session / 课前回忆'),
            React.createElement('p', { style: groupDescriptionStyle }, 'One ungraded recall question before teaching.'),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              role: 'switch',
              'aria-checked': draft.recallSessionEnabled,
              'aria-label': 'Recall Session',
              'data-setting': 'recallSessionEnabled',
              'data-state': draft.recallSessionEnabled ? 'on' : 'off',
              disabled: !writable || saving,
              onClick: () => updateDraft('recallSessionEnabled', !draft.recallSessionEnabled),
              style: switchStyle(draft.recallSessionEnabled, !writable || saving),
            },
            React.createElement('span', null, draft.recallSessionEnabled ? 'On' : 'Off'),
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
            React.createElement('h3', { style: groupTitleStyle }, 'Post-lecture questions'),
            React.createElement('p', { style: groupDescriptionStyle }, 'Choose how many unseen questions follow each lecture.'),
          ),
          React.createElement(
            'div',
            { style: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' } },
            React.createElement(
              'label',
              { htmlFor: 'nerd-mode-question-count', style: fieldLabelStyle },
              React.createElement('span', null, 'Question count'),
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
              React.createElement('span', { style: fieldHintStyle }, 'Use 0 to skip unseen questions.'),
            ),
            React.createElement(
              'label',
              { htmlFor: 'nerd-mode-question-type', style: fieldLabelStyle },
              React.createElement('span', null, 'Question type'),
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
                React.createElement('option', { value: 'short-answer' }, 'Short answer'),
                React.createElement('option', { value: 'multiple-choice' }, 'Multiple choice'),
                React.createElement('option', { value: 'mixed' }, 'Mixed'),
              ),
              React.createElement('span', { style: fieldHintStyle }, 'Mixed chooses a type for each question.'),
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
          }, 'Restore defaults'),
          React.createElement(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' } },
            React.createElement('button', {
              type: 'button',
              disabled: !dirty || saving,
              onClick: cancel,
              style: secondaryButtonStyle,
            }, 'Cancel'),
            React.createElement('button', {
              type: 'button',
              disabled: !dirty || !validSettings(draft) || !writable || saving,
              onClick: save,
              style: primaryButtonStyle,
            }, saving ? 'Saving…' : 'Save'),
          ),
        ),
        snapshot?.writable === false
          ? React.createElement('p', { role: 'status', style: feedbackStyle }, 'These profile settings are read-only.')
          : null,
        feedback === null
          ? null
          : React.createElement('p', {
            role: feedback.startsWith('Could not save') ? 'alert' : 'status',
            style: feedbackStyle,
          }, feedback),
      );
    }

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
          const text = `Nerd Mode did not switch: ${error?.message ?? 'the host rejected the command'}`;
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

    return {
      inject: ['slots', 'remote', 'remote.commands', 'configForms'],
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
        ctx.slots.inject(SETTINGS_SLOT, () =>
          ctx.slots.register({
            name: SETTINGS_SLOT,
            id: 'dsh-nerd-mode',
            order: 30,
            label: LABEL,
          }, ({ close }) => React.createElement(NerdModeSettingsEntry, {
            close,
            configForms: ctx.configForms,
          })),
        );
      },
    };
  },
});
