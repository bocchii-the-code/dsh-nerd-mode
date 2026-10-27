# Study Plus for DeepSeek Harness

A Study mode preset with a dated learner model, target paths, and source checks.
It bundles six skills and a platform-aware shell.

## Requirements

- DeepSeek Harness with a profile.
- Node.js 22.19 or newer.
- Windows, macOS, or Linux.
- PowerShell on Windows. Bash on macOS and Linux.

## Install

From npm:

```powershell
dsh plugin --profile <profile> add study-plus-dsh
```

From GitHub:

```powershell
dsh plugin --profile <profile> add github:<you>/study-plus-dsh
```

From a local folder or tarball:

```powershell
dsh plugin --profile <profile> add C:\path\to\study-plus-dsh
```

Restart dsh. The mode picker shows **Study Plus**.

## Use

```text
/study-plus Shampoo and Adam optimizers
```

The preset id is `study-plus`. If another preset already uses that id, change
`config.id` and `config.name` in `cordis.patch.yml`.

## Skills included

- `study-plus`
- `teach`
- `diagram`
- `writing-beats`
- `humanizer`
- `convert-documents-to-markdown`

The `answer-me-with-html` skill is not included. Install it separately if you
want one-page HTML explainers.

## Shell

The preset lists both shell plugins with platform gates:

- `tool-bash` is disabled on Windows.
- `tool-pwsh` is disabled on macOS and Linux.

The skill and persona say "host shell", so the model uses whichever one loads.

## Notes

- The package resolves its own `skills/` folder from `cordis.patch.yml` with a
  `!!js` expression. Review patch changes as host-process code.
- If you rename the package, update the `resolve('study-plus-dsh/package.json')`
  string in `cordis.patch.yml`.
- Published on npm as `study-plus-dsh` under the MIT license. The bundled
  third-party skills keep their own licenses.
- Tested on DSH Desktop 2.0.5 with `@deepseek-ai/dsh@0.1.2-rc.1` and Node 22.

## Uninstall

```powershell
dsh plugin --profile <profile> remove study-plus-dsh
```
