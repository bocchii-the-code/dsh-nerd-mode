window.__ModuleLoader__.load({
  id: 'study-plus-dsh/client',
  factory(require) {
    const React = require('react');

    function StudyModeChip({ useProjection, execute }) {
      const studyMode = useProjection('studyMode');
      const [failed, setFailed] = React.useState(false);
      const projectedActive = studyMode?.active === true;
      const active = !failed && projectedActive;

      React.useEffect(() => {
        setFailed(false);
      }, [studyMode?.active]);

      return React.createElement('button', {
        type: 'button',
        title: 'Study mode',
        'aria-pressed': active,
        onClick: async () => {
          try {
            const result = await execute(
              active ? '/study-mode off' : '/study-mode on',
            );
            setFailed(!result.ok || result.value === void 0);
          } catch {
            setFailed(true);
          }
        },
        style: {
          alignItems: 'center',
          background: active
            ? 'var(--dsw-alias-state-business-tertiary)'
            : 'var(--dsw-alias-fill-tsp-secondary)',
          border: 'none',
          borderRadius: 'var(--dsw-radius-sm)',
          color: active
            ? 'var(--dsw-alias-state-business-primary)'
            : 'var(--dsw-alias-label-tertiary)',
          cursor: 'pointer',
          display: 'inline-flex',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 500,
          height: 28,
          lineHeight: '20px',
          minWidth: 34,
          opacity: active ? 1 : 0.65,
          padding: '0 8px',
        },
        children: 'Nerd mode',
      });
    }

    return {
      inject: ['slots', 'remote.commands'],
      apply(ctx) {
        ctx.slots.inject('conversation.session.header.actions', () =>
          ctx.slots.register({
            name: 'conversation.session.header.actions',
            id: 'study-mode',
            order: -9,
            inject: (sessionId) => ({
              execute: (command) => ctx.remote.commands.execute(sessionId, command, []),
            }),
          }, StudyModeChip),
        );
      },
    };
  },
});
