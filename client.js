window.__ModuleLoader__.load({
  id: 'dsh-nerd-mode/client',
  factory(require) {
    const React = require('react');
    const { Toast } = require('@deepseek-ai/dsh-client-ui-primitives');

    const SLOT = 'conversation.input.left';
    const LABEL = 'Nerd Mode';

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
      inject: ['slots', 'remote', 'remote.commands'],
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
      },
    };
  },
});
