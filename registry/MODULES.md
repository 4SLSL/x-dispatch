# X-Dispatch community modules — author guide

Optional extensions installed as ZIP archives. The core stays free of business-specific modules (no SIA, VAC, JFS4XD, etc.).

## Concepts

| Kind         | Source                        | Location                                    | Uninstall |
| ------------ | ----------------------------- | ------------------------------------------- | --------- |
| **bundled**  | Shipped with the app (future) | App resources                               | No        |
| **external** | User ZIP                      | `userData/community-modules/external/<id>/` | Yes       |

Runtime files:

```
<userData>/community-modules/
  state.json
  contribution-toggles.json   # phase 2a toggle values
  external/<id>/x-dispatch-module.json
```

---

## Manifest (`x-dispatch-module.json`)

At ZIP root or one subfolder deep.

### Phase 1 fields

```json
{
  "id": "com.example.hello",
  "name": "Hello Module",
  "version": "1.0.0",
  "description": "Optional",
  "author": "Your Name",
  "minAppVersion": "1.9.2"
}
```

| Field           | Required | Rules                            |
| --------------- | -------- | -------------------------------- |
| `id`            | yes      | Reverse-domain slug, 3–128 chars |
| `name`          | yes      | 1–120 chars                      |
| `version`       | yes      | Semver `MAJOR.MINOR.PATCH`       |
| `minAppVersion` | no       | App must be ≥ this version       |
| `kind`          | no       | ZIP installs force `external`    |

Schema: `src/lib/communityModules/types.ts`.

### Phase 2a — `contributions.settings`

Declarative rows shown under **Settings → Modules** when the module is **enabled**:

```json
{
  "id": "com.example.hello",
  "name": "Hello Module",
  "version": "1.0.1",
  "minAppVersion": "1.9.3",
  "contributions": {
    "settings": [
      {
        "id": "docs",
        "type": "link",
        "label": "Module documentation",
        "url": "https://example.com/docs"
      },
      {
        "id": "verbose",
        "type": "toggle",
        "label": "Verbose logging",
        "description": "Stored by the core until phase 2b reads it.",
        "default": false
      }
    ]
  }
}
```

| `type`   | Fields                                              | Behavior                                 |
| -------- | --------------------------------------------------- | ---------------------------------------- |
| `link`   | `label`, `url`, optional `description`              | Opens URL via Electron shell             |
| `toggle` | `label`, optional `description`, optional `default` | Persisted in `contribution-toggles.json` |

Limits: max **12** settings rows per module; `id` per row must be unique within the module.

### Phase 2b — `renderer` + `contributions.sidebar`

```json
{
  "contributions": {
    "sidebar": [{ "id": "vac", "label": "VAC" }]
  },
  "renderer": { "entry": "dist/renderer.mjs" }
}
```

The core loads the module renderer bundle when a module sidebar tab is selected in **Settings**.

- `contributions.sidebar` creates module entries in the Settings sidebar.
- `renderer.entry` is required when `contributions.sidebar` is declared.
- The renderer bundle must export a default React component receiving:
  - `moduleId`
  - `moduleName`
  - `entryId`

---

## Packaging

```
my-module.zip
├── x-dispatch-module.json
└── dist/renderer.mjs   # required if contributions.sidebar is declared
```

```bash
zip -r ../com.example.hello-1.0.1.zip x-dispatch-module.json
```

Install: **Settings → Modules → Install from ZIP…**

---

## IPC (renderer: `window.modulesAPI`)

| Channel                         | Phase | Description                          |
| ------------------------------- | ----- | ------------------------------------ |
| `modules:list`                  | 1     | Installed modules                    |
| `modules:getContributions`      | 2a    | Enabled modules' settings rows       |
| `modules:setContributionToggle` | 2a    | Persist a toggle                     |
| `modules:enable` / `disable`    | 1     | Updates state; emits lifecycle event |
| `modules:installFromZip`        | 1     | Install external ZIP                 |
| `modules:uninstall`             | 1     | External only                        |
| `modules:getCatalog`            | 1     | `registry/modules.json`              |
| `modules:browseForZip`          | 1     | File picker                          |
| `modules:getSidebarTabs`        | 2b    | Enabled module sidebar tabs          |

Lifecycle (phase 2): `modulesAPI.onLifecycle(cb)` → `{ moduleId, enabled }` when a module is toggled in Settings.

---

## Roadmap

| Phase                                   | Status  |
| --------------------------------------- | ------- |
| 1 — install, enable, Settings list      | done    |
| 2a — declarative Settings contributions | done    |
| 2b — renderer bundle load               | done    |
| 3 — catalog sync, signatures            | planned |

---

## Author checklist

- [ ] Unique stable `id`; semver `version` on each release
- [ ] `minAppVersion` if you use phase 2 fields
- [ ] `contributions.settings` ids are lowercase slugs (`my-toggle`)
- [ ] URLs use `https://`
- [ ] Tested enable/disable and contribution toggles
- [ ] No map/DB/protocol hooks (not supported)

## Reviewer checklist

- [ ] No business modules in core
- [ ] Focused diff; `npm run check` green
- [ ] Manifest validation + path traversal safe
- [ ] `registry/MODULES.md` matches schema

---

Support: [lyestarzalt/x-dispatch](https://github.com/lyestarzalt/x-dispatch) — module bugs go to the module author.
