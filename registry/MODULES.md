# X-Dispatch community modules — author guide

This document describes how to build, package, and publish **optional community modules** for X-Dispatch. Phase 1 covers manifest validation, ZIP install, enable/disable, and uninstall — not renderer code injection.

## Concepts

### Bundled vs external

| Kind         | Source                                     | Install location                            | Uninstall   |
| ------------ | ------------------------------------------ | ------------------------------------------- | ----------- |
| **bundled**  | Shipped inside the X-Dispatch app (future) | App resources                               | Not allowed |
| **external** | User-installed ZIP                         | `userData/community-modules/external/<id>/` | Allowed     |

ZIP installs are always recorded as **external**, even if the manifest omits `kind`.

### Runtime state

The main process keeps authoritative state in:

```
<userData>/community-modules/
  state.json              # enabled flags, manifest snapshot, paths
  external/
    com.example.hello/
      x-dispatch-module.json
      ...                 # module files (assets, docs; no renderer bundle in phase 1)
```

Each module record tracks:

- `id`, `kind`, `enabled`
- `installPath`, `manifest`, `installedAt`, `updatedAt`

The renderer reads the list via `window.modulesAPI.list()` (IPC `modules:list`). Toggling enable/disable updates `state.json` only; **no module code runs in phase 1**.

### Catalog (`registry/modules.json`)

The optional catalog lists modules discoverable from Settings (future: download from GitHub). The file may be empty. Packaged builds include `registry/` as an Electron extra resource.

---

## Manifest (`x-dispatch-module.json`)

Place this file at the **root of the ZIP** (or one folder below the archive root).

### Minimal valid example

```json
{
  "id": "com.example.hello",
  "name": "Hello Module",
  "version": "1.0.0",
  "description": "Optional short description",
  "author": "Your Name",
  "minAppVersion": "1.9.0"
}
```

### Schema (TypeScript / Zod)

| Field           | Required | Rules                                                   |
| --------------- | -------- | ------------------------------------------------------- |
| `id`            | yes      | 3–128 chars, reverse-domain slug (`com.author.name`)    |
| `name`          | yes      | Display name, 1–120 chars                               |
| `version`       | yes      | Semver `MAJOR.MINOR.PATCH` (optional `-prerelease`)     |
| `description`   | no       | Max 500 chars                                           |
| `author`        | no       | Max 120 chars                                           |
| `minAppVersion` | no       | Semver triple; install rejected if app is older         |
| `kind`          | no       | `bundled` \| `external` — ZIP installs force `external` |

Implementation: `src/lib/communityModules/types.ts` (`moduleManifestSchema`).

---

## Packaging a ZIP

### Layout

**Option A — flat root (preferred):**

```
hello-module.zip
├── x-dispatch-module.json
├── README.md
└── assets/
    └── icon.png
```

**Option B — single wrapper folder:**

```
hello-module.zip
└── hello-module/
    ├── x-dispatch-module.json
    └── ...
```

The installer extracts the archive, locates `x-dispatch-module.json` at the root or one level down, validates it, then copies the module folder to `external/<id>/`.

### Rules

1. **ZIP only** in phase 1 (reuses addon manager `extractArchive`).
2. Manifest `id` must match the intended folder name after install.
3. Do not rely on `..` paths or absolute paths inside the archive.
4. Re-installing the same `id` **replaces** the previous copy (upgrade path).

### Create a test archive

```bash
cd my-module
zip -r ../com.example.hello-1.0.0.zip x-dispatch-module.json README.md assets/
```

Install via **Settings → Modules → Install from ZIP…**

---

## What the core does today vs module limits

### Phase 1 (implemented)

| Capability                                        | Status             |
| ------------------------------------------------- | ------------------ |
| Validate manifest                                 | yes                |
| Install / enable / disable / uninstall (external) | yes                |
| Persist state under `userData`                    | yes                |
| Settings UI list + toggle + ZIP install           | yes                |
| Optional catalog file                             | yes (may be empty) |

### Not available to modules alone (phase 1)

| Capability                                | Status                                       |
| ----------------------------------------- | -------------------------------------------- |
| Load renderer JS/CSS bundle               | **not implemented** (phase 2b)               |
| Register map layers / toolbar buttons     | **not implemented**                          |
| Custom protocols (`vac-pdf:`, `mbtiles:`) | **not implemented**                          |
| DB migrations / core hooks                | **not implemented**                          |
| Per-module lifecycle IPC execution        | **stub** — enable/disable only updates state |

Modules are **inert packages** until later phases wire lifecycle and UI extension points.

---

## Roadmap (short)

| Phase           | Focus                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| **1** (current) | Manifest, ZIP install, enable/disable, Settings UI, catalog file         |
| **2a**          | Declarative UI contributions (settings rows, menu entries) from manifest |
| **2b**          | Renderer bundle load (sandboxed `import()` / dedicated entry)            |
| **3**           | GitHub catalog sync, signatures, version resolution                      |

### Lifecycle IPC (planned)

Future channels (not wired in phase 1):

- `modules:notifyEnabled` / `modules:notifyDisabled` — main notifies renderer when a module is toggled
- Module-specific handlers registered by the core after bundle load (phase 2b)

---

## Author checklist

- [ ] `id` is unique, stable, reverse-domain style
- [ ] `version` semver bumped on each release
- [ ] `minAppVersion` set if you depend on new core APIs
- [ ] `x-dispatch-module.json` at ZIP root (or one subfolder)
- [ ] Tested install on a clean profile (no modules installed)
- [ ] Tested enable/disable and uninstall
- [ ] README inside ZIP explains what the module will do once phase 2 lands
- [ ] No proprietary / copyrighted assets without license
- [ ] No coupling to X-Plane paths unless documented

---

## Reviewer checklist (core PR)

- [ ] No business modules (SIA, VAC, JFS4XD, etc.) in core
- [ ] Diff stays focused (~600–900 LOC applicatif hors i18n)
- [ ] `npm run check` passes
- [ ] IPC namespaced `modules:*`, preload `modulesAPI` only exposes needed methods
- [ ] Path traversal / manifest validation covered
- [ ] Bundled modules cannot be uninstalled via IPC
- [ ] Boot unchanged when `community-modules/` is absent
- [ ] `registry/MODULES.md` updated if schema changes

---

## IPC reference (phase 1)

| Channel                              | Description                                  |
| ------------------------------------ | -------------------------------------------- |
| `modules:list`                       | Installed modules + enabled state            |
| `modules:getCatalog`                 | Read `registry/modules.json`                 |
| `modules:browseForZip`               | Native file picker (.zip)                    |
| `modules:installFromZip`             | Extract, validate, copy to `external/`       |
| `modules:enable` / `modules:disable` | Toggle `enabled` in state                    |
| `modules:uninstall`                  | Remove external module (fails for `bundled`) |

Renderer: `window.modulesAPI.*` (see `src/preload.ts`).

---

## Support

Open issues or discussions on [lyestarzalt/x-dispatch](https://github.com/lyestarzalt/x-dispatch). For module-specific bugs, contact the module author.
