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
    const DASH = '—';

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
        const topicMatch = /^#\s*Topic:\s*(.+)$/i.exec(trimmed);
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

    const latestEvidence = (text) => {
      const dates = [...parseState(text).states.values()].map((row) => row.date ?? '');
      return dates.sort().pop() ?? '';
    };

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

    // "Changed most recently" is read from the newest dated Evidence, because
    // the file surface exposes no modification time.
    async function discoverTopics(files, sessionId) {
      const listing = await files.list(sessionId, TRACKER_ROOT);
      if (!listing.ok) {
        if (listing.error?.code === 'workspace-file/not-found') return { topics: [], content: { status: 'empty' } };
        throw new Error(listing.error?.message ?? 'the Tracker folder could not be read');
      }
      const topics = (listing.value?.entries ?? [])
        .filter((entry) => entry.type === 'directory')
        .map((entry) => entry.name);
      if (topics.length === 0) return { topics, content: { status: 'empty' } };
      const states = [];
      for (const topic of topics) {
        states.push({ topic, text: await readText(files, sessionId, `${TRACKER_ROOT}/${topic}/state.md`) });
      }
      states.sort((left, right) => latestEvidence(right.text).localeCompare(latestEvidence(left.text)));
      const chosen = states[0];
      return { topics, content: await loadTopic(files, sessionId, chosen.topic, chosen.text) };
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
        React.createElement('span', null, 'Topic'),
        React.createElement('select', {
          'aria-label': 'Topic',
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
          `The Tracker could not be read: ${error}.`));
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

      React.useEffect(() => {
        let live = true;
        const run = async () => {
          try {
            const found = selected === null
              ? await discoverTopics(workspaceFiles, sessionId)
              : { topics: null, content: await loadTopic(workspaceFiles, sessionId, selected) };
            if (!live) return;
            if (found.topics !== null) setTopics(found.topics);
            setContent(found.content);
          } catch (error) {
            if (!live) return;
            const message = error?.message ?? 'the Tracker could not be read';
            // Keep the last good snapshot so a failed reload does not blank the page.
            setContent((previous) => previous.status === 'ready' || previous.status === 'empty'
              ? { ...previous, error: message }
              : { status: 'failed', error: message });
          }
        };
        run();
        return () => { live = false; };
      }, [selected, sessionId, workspaceFiles]);

      let nodes;
      if (content.status === 'loading') {
        nodes = [React.createElement('p', { role: 'status', 'aria-busy': true, style: panelMutedStyle }, 'Loading the Tracker…')];
      } else if (content.status === 'failed') {
        nodes = [React.createElement('p', { role: 'alert', style: panelMutedStyle }, `The Tracker could not be read: ${content.error}.`)];
      } else if (content.status === 'empty') {
        const searched = content.topic ? `${TRACKER_ROOT}/${content.topic}` : `${TRACKER_ROOT}/`;
        const picker = topicPicker(topics, content.topic ?? selected, setSelected);
        nodes = [
          picker === null ? null : React.createElement('div', { style: panelHeaderStyle }, picker),
          React.createElement('p', { style: panelMutedStyle }, `No Tracker in ${searched}. Run /study-plus to create one.`),
        ];
      } else {
        nodes = readyBody(content.snapshot, content.error, topics, setSelected);
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
    // The seat only. The list and its reads arrive in a later ticket.
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

    function LecturesPage() {
      return React.createElement(
        'div',
        { role: 'region', 'aria-label': LECTURES_LABEL, style: panelStyle },
        React.createElement('p', { style: panelMutedStyle }, 'Saved lectures will appear here.'),
      );
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
        }, LecturesPage));
      },
    };
  },
});
