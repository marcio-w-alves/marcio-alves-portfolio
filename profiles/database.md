# The profile database

A profile bundle (`README.md` beside this file) is how you read and edit a profile. The database
is where it lives: one Neon Postgres database that the site reads **only at build time**. No
request a visitor makes opens a database connection, so a database outage blocks deploys and
nothing else.

## What it holds

One profile, kept as immutable **revisions**. A revision is a set of **documents** — the files of
a bundle — pointing at **blobs**, and each blob is keyed by the SHA-256 of its own bytes. A single
`head` row says which revision is the profile. A write inserts a new revision and moves the head
in one serializable transaction, so a write that is interrupted leaves the previous profile
exactly as it was.

| Table                      | Holds                                                           |
| -------------------------- | --------------------------------------------------------------- |
| `profile.blob`             | the bytes of every document, keyed by their SHA-256             |
| `profile.revision`         | one row per revision: digest, bundle format, origin, note, time |
| `profile.document`         | bundle path → media type → blob, per revision                   |
| `profile.head`             | one row: the revision the site is built from                    |
| `profile.schema_migration` | the migrations applied, with the checksum of each               |

The **digest** of a revision is the SHA-256 of a manifest of `path<TAB>media type<TAB>sha256`
lines, sorted by the bytes of the path. The client and the database compute it the same way
(`profile.digest_of`), which is what makes export → import → export checkable and an import of an
unchanged bundle a no-op. Every read re-hashes what it was given and refuses a profile whose bytes
do not match their keys.

The newest 20 revisions are kept; older ones, and the blobs no revision names any more, are
deleted after each write.

## The two roles

| Role             | May                                          | Lives                              |
| ---------------- | -------------------------------------------- | ---------------------------------- |
| `profile_owner`  | read and write the profile, apply migrations | your machine only (`.env.local`)   |
| `profile_reader` | `select` on those five tables, nothing else  | the deployment and CI, as a secret |

`profile_reader` is read-only by default (`default_transaction_read_only`), has a 15 s statement
timeout and at most five connections. It cannot insert, update, delete, create a table or call
`profile.revise` — even with the read-only default turned off, the grants refuse it.

| Variable                     | Role                     | Where                                        |
| ---------------------------- | ------------------------ | -------------------------------------------- |
| `PROFILE_ADMIN_DATABASE_URL` | the database's own owner | used once by `init`, then unset              |
| `PROFILE_OWNER_DATABASE_URL` | `profile_owner`          | your `.env.local`                            |
| `PROFILE_DATABASE_URL`       | `profile_reader`         | the deployment (Sensitive), CI, `.env.local` |

Every connection requires TLS the client verifies, and there is no setting that turns that off.
On Vercel, **do not install the Neon marketplace integration**: it injects the database owner's
credential into every environment.

## Creating the schema and the roles

1. Create a Neon project (the Free plan is enough; a profile is a few MB) and copy the connection
   string of the database's own owner, e.g.
   `postgres://neondb_owner:…@ep-….aws.neon.tech/neondb?sslmode=require`.
2. Create the store:

   ```bash
   PROFILE_ADMIN_DATABASE_URL='postgres://neondb_owner:…@ep-….aws.neon.tech/neondb' \
     pnpm profile init
   ```

   It creates the two roles with 256-bit random passwords, the `profile` schema, and the
   migrations, and writes both connection URLs to
   `$PROFILE_HOME/credentials/<host>__<database>.env` (mode `0600`). It never prints a password.
   Run it again and it changes nothing.

3. Copy `PROFILE_OWNER_DATABASE_URL` from that file into `.env.local`, and `PROFILE_DATABASE_URL`
   into the deployment's environment (production and preview) and the CI secret.
4. Put a profile in it, and see what a build would read:

   ```bash
   pnpm profile import profiles/example      # or your own bundle, from outside the repository
   pnpm profile revisions
   ```

A later schema change ships as a new `scripts/profile/store/migrations/NNNN_name.sql`, applied
with `pnpm profile migrate`. An applied migration is never edited: the runner refuses a file whose
text has changed since it ran.

## The commands

| Command                              | Credential | Does                                                                          |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------- |
| `pnpm profile init`                  | admin      | roles, schema, migrations — from an empty database, once                      |
| `pnpm profile migrate`               | owner      | applies the pending migrations                                                |
| `pnpm profile export [dir]`          | reader     | writes the stored profile out as a bundle (default `$PROFILE_HOME/bundles/…`) |
| `pnpm profile check <dir>`           | —          | every check on a bundle; writes nothing                                       |
| `pnpm profile diff <dir>`            | reader     | what importing that bundle would change, by document and id                   |
| `pnpm profile import <dir> [--note]` | owner      | checks, backs up, then replaces the profile in one transaction                |
| `pnpm profile revisions`             | reader     | the revisions that are kept, head first                                       |
| `pnpm profile restore <revision>`    | owner      | makes an earlier revision the profile again, as a new revision                |
| `pnpm profile materialize --out`     | reader     | writes the files the site is built from                                       |

Bundles, backups and the credentials file are written under `PROFILE_HOME`
(`${XDG_DATA_HOME:-~/.local/share}/portfolio-profile`, mode `0700`). The tools **refuse** to write
a profile inside any work tree of this repository: the guarantee is that they cannot, not that
`.gitignore` would hide it.

## Editing

```bash
pnpm profile export ~/profile-work
$EDITOR ~/profile-work/knowledge/experience.yaml
pnpm profile diff ~/profile-work                   # what would change, by document and id
pnpm profile import ~/profile-work --note 'a new role'
```

An invalid bundle changes nothing and names every problem by path. One text document can also be
replaced in SQL, as a new revision:

```sql
select profile.revise(jsonb_build_object('put', jsonb_build_object(
  'privacy.yaml', jsonb_build_object('mediaType', 'application/yaml', 'text', $$phrases: []$$))),
  'a hand edit');
```

The checks run at the next build, which fails rather than ship a profile that does not hold.

## Backups and restores

Four layers, in the order you would reach for them.

1. **The revisions in the database.** The newest 20. `pnpm profile revisions` lists them;
   `pnpm profile restore <id>` makes one of them the profile again, as a new revision — so a
   restore is itself something you can undo.
2. **The backup taken before every write.** `import` and `restore` export the current profile to
   `$PROFILE_HOME/backups/<UTC>-rev<id>/`, read it back, check its digest and print the path
   **before** anything is written. Bring it back with `pnpm profile import <that directory>`.
3. **Neon's instant restore (point in time).** The window depends on the plan — **6 hours on the
   Free plan**; confirm it in the project's settings and record the plan you are on here. To
   restore: Neon console → the branch → **Restore**, and pick a time inside the window. Restoring
   to a new branch first and reading it (`PROFILE_DATABASE_URL` pointed at the branch, then
   `pnpm profile revisions`) is the safer order.
4. **Manual exports**, which are unbounded. Take one with `pnpm profile export` after every
   publish and at least weekly while you are editing, and keep one off the machine. Anything
   older than Neon's window is covered by these alone.

Whatever the layer, a restore is checked the same way: `pnpm profile revisions` shows the digest
at head, and a build from it must match the baseline (`pnpm baseline:compare`).

Rotating a credential needs no code change: `alter role profile_reader password '…'` (or the Neon
console), then update the deployment's variable and the CI secret, and redeploy.

## Running the store's tests

The store suite runs against a real Postgres 17 over TLS the client verifies. Nothing about the
database is mocked anywhere, and there is no test-only way to accept a certificate — so a test
database needs one, which the script generates:

```bash
export $(scripts/profile/store/testing/postgres.sh start | xargs)   # a CA, a cert, a container
pnpm test:store
scripts/profile/store/testing/postgres.sh stop
```

`pnpm test:store` **fails** when `PROFILE_TEST_ADMIN_URL` is unset; it never skips. CI's `store`
job does the same, with no secret of any kind.
