# Profile bundles

A **profile bundle** is one whole profile — who the site is about, their
record, their copy, their brand, their files — as a directory of plain files
you can read, edit and keep. `example/` is the shipped one: Ada Rivera, a
fictional platform engineer, written in English and Portuguese. Copy it to
start your own, and keep your own bundle **outside this repository**: it holds
your personal data.

```bash
pnpm profile check <bundle dir>                 # every check, nothing written
pnpm profile materialize --out <dir>            # the files the site is built from
```

## What a bundle holds

| Path                                                   | Holds                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bundle.yaml`                                          | `format: 1` and `locales`, the languages the site is published in (`en` first)                                                                                                 |
| `identity.yaml`                                        | Name, initials, email, LinkedIn, GitHub, the site's domain, its User-Agent product, the names that are ordinary words (`nonIdentifyingTerms`)                                  |
| `brand.yaml`                                           | One colour per design token, light and dark; per font role, a `face` the template bundles (`inter`, `inter-tight`, `geist-mono`) and its fallbacks                             |
| `knowledge/*.yaml`                                     | The record: `profile.yaml` (profile, welcome, assistant, contact, principles), `experience`, `metrics`, `projects`, `skills`, `education`, `practice`, `references`, `sources` |
| `knowledge/knowledge-base.md`                          | Long-form notes; each numbered `##` section becomes passages the assistant searches                                                                                            |
| `knowledge/notes-guide.md`                             | How the assistant reads the evidence tags of the notes                                                                                                                         |
| `sites/allow-list.yaml`                                | The public pages of your products and companies the assistant may read                                                                                                         |
| `copy/<locale>/answers/*.yaml`, `copy/<locale>/*.yaml` | What the site writes around your facts, per language                                                                                                                           |
| `evaluation/cases.yaml`, `evaluation/calibration.yaml` | The conversations `pnpm eval:assistant` holds the assistant to, and the answers its judge is checked on                                                                        |
| `retrieval/probes.yaml`                                | Questions embedded beside the index (`id: question`), so tests search it as a visitor would                                                                                    |
| `privacy.yaml`                                         | Terms the privacy scan looks for that the record cannot give: `phone`, `address`, `phrases`                                                                                    |
| `assets.yaml`, `assets/<file>`                         | The files the site serves from its own origin: `- {file: assets/x.pdf, path: /x.pdf, mediaType: application/pdf}`                                                              |
| `generated/*.json`, `sites/snapshot.json`              | Written by the tools, never by hand: the note passages, the retrieval index, the probe embeddings, the sites' passages                                                         |

Every visitor-facing text is written per language, `{ en: …, pt-BR: … }`; ids,
dates, metric values, links and names once. A translation states exactly the
numbers, dates and links its English text does.

## The rules a bundle is held to

- Only the paths above; dotfiles are ignored, symbolic links refused. Names use
  letters, digits, `.`, `_` and `-`.
- Text is UTF-8, without a byte order mark, with LF line endings.
- YAML 1.2, strictly: no duplicate keys, no merge keys (`<<`), no tags, at most
  100 aliases. `yes` is the word "yes".
- At most 400 documents and 50 MiB; a document at most 25 MiB; an asset at most
  10 MiB, and only PDF, JPEG, PNG or WebP whose bytes match the extension.
- Assets are served at the site's root (`/name.ext`), never at an address the
  site answers itself (`/api`, `/en`, `/pt`, `/icon`, `/robots.txt`, …). The
  record's `photoUrl` and `resumeUrl` must be among them.
- The checks — shape, translations, site passages, index against the record,
  notes against the knowledge base, assets, evaluation — run on every
  `check` and `materialize`. A problem is reported as
  `<document>#<where>: <problem> — <what to do>`, every one of them at once.

## Which profile a build uses

`PROFILE_SOURCE` (`database`, `bundle` or `example`) decides when set.
Otherwise `PROFILE_DATABASE_URL` means the database, `PROFILE_BUNDLE_DIR` a
bundle directory, and with neither the example is used — except in a production
deployment (`VERCEL_ENV=production`), which fails instead, unless
`PROFILE_SOURCE=example` says the example is meant.

## Your own bundle

Keep it outside the repository, under `PROFILE_HOME`
(`${XDG_DATA_HOME:-~/.local/share}/portfolio-profile` by default); the tools
refuse to write profile data inside a work tree. While the profile this
repository is about is still TypeScript, this writes it as a bundle there:

```bash
pnpm exec tsx scripts/profile/export-repository-profile.mts
pnpm profile check "$HOME/.local/share/portfolio-profile/bundles/owner"
```

## The example's own files

Its photo and résumé are drawn from its record, and its generated files are
built without a key (a seeded index instead of embeddings):

```bash
pnpm exec tsx scripts/example/render-example-assets.mts
pnpm exec tsx scripts/example/generate-example-files.mts
```
