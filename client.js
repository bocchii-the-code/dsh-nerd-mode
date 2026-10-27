window.__ModuleLoader__.load({
  id: 'dsh-nerd-mode/client',
  factory(require) {
    const React = require('react');

    const SLOT = 'conversation.input.left';
    const LABEL = 'Nerd mode';

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
    function pillStyle(active, failed) {
      if (failed) {
        const error = 'var(--dsw-alias-state-error-primary, #e5484d)';
        return {
          background: `color-mix(in srgb, ${error} 16%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${error} 55%, transparent)`,
          color: error,
        };
      }
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

    function NerdModeToggle({ useProjection, execute }) {
      const state = useProjection('studyMode');
      const active = state?.active === true;
      const [busy, setBusy] = React.useState(false);
      const [failed, setFailed] = React.useState(false);

      React.useEffect(() => {
        setFailed(false);
      }, [active]);

      const onClick = async () => {
        if (busy) return;
        setBusy(true);
        setFailed(false);
        try {
          const result = await execute(active ? '/nerd-mode off' : '/nerd-mode on');
          if (!result?.ok || result.value === undefined) setFailed(true);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      };

      return React.createElement(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': active,
          'aria-label': LABEL,
          'data-state': failed ? 'error' : active ? 'on' : 'off',
          title: failed
            ? 'Nerd mode did not switch. Click to retry.'
            : active
              ? 'Nerd mode is on'
              : 'Nerd mode is off',
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
            ...pillStyle(active, failed),
          },
        },
        BOOK,
        React.createElement('span', null, LABEL),
      );
    }

    return {
      inject: ['slots', 'remote.commands'],
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
