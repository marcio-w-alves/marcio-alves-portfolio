-- The profile store: one profile, kept as immutable content-addressed
-- revisions with a single head pointer the build reads.
--
-- Blobs are the bytes of a bundle's documents, keyed by their own SHA-256, so
-- an export reproduces a bundle byte for byte and two revisions share whatever
-- they have in common. A revision names the documents of one whole profile; it
-- is never edited, only superseded. `head` says which revision is the profile.
--
-- Run as `profile_owner`; `pnpm profile init` creates the schema and the roles.

create table profile.blob (
  sha256 bytea primary key,
  bytes  bytea not null,
  constraint blob_is_content_addressed check (sha256 = pg_catalog.sha256(bytes)),
  constraint blob_size check (octet_length(bytes) <= 26214400)            -- 25 MiB
);

create table profile.revision (
  id            bigint generated always as identity primary key,
  -- The digest of the whole profile (see scripts/profile/bundle/digest.ts).
  -- Not unique: restoring an earlier profile states its digest again.
  digest        bytea not null check (octet_length(digest) = 32),
  bundle_format integer not null check (bundle_format > 0),
  origin        text not null check (origin in
                  ('import', 'rag-build', 'notes-build', 'sites-ingest', 'restore', 'sql')),
  note          text check (length(note) <= 500),
  created_at    timestamptz not null default now(),
  created_by    text not null default current_user
);
create index revision_digest on profile.revision (digest);

create table profile.document (
  revision_id bigint not null references profile.revision (id) on delete cascade,
  path        text collate "C" not null,
  media_type  text not null,
  blob_sha256 bytea not null references profile.blob (sha256),
  primary key (revision_id, path),
  constraint document_path check (
    path ~ '^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*$'),
  constraint document_media_type check (media_type in ('application/yaml', 'text/markdown',
    'application/json', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
);
create index document_blob on profile.document (blob_sha256);

-- One row, so there is one profile. The reference has no action on delete:
-- pruning old revisions can never remove the one the site is built from.
create table profile.head (
  singleton   boolean primary key default true check (singleton),
  revision_id bigint not null references profile.revision (id),
  updated_at  timestamptz not null default now()
);

create function profile.forbid_update() returns trigger language plpgsql as
  $$ begin raise exception 'profile revisions are immutable; write a new revision'; end $$;
create trigger revision_immutable before update on profile.revision
  for each row execute function profile.forbid_update();
create trigger document_immutable before update on profile.document
  for each row execute function profile.forbid_update();

-- The digest of a revision, computed exactly as the client computes a bundle's:
-- one line per document, `path<TAB>media type<TAB>sha256`, sorted by the bytes
-- of the path, hashed as UTF-8. Equal digests mean identical profiles.
create function profile.digest_of(revision bigint) returns bytea language sql stable as $$
  select pg_catalog.sha256(convert_to(coalesce(string_agg(
           d.path || E'\t' || d.media_type || E'\t' || encode(b.sha256, 'hex'),
           E'\n' order by d.path collate "C"), ''), 'UTF8'))
    from profile.document d
    join profile.blob b on b.sha256 = d.blob_sha256
   where d.revision_id = revision;
$$;

-- The SQL editing path: a new revision from head with text documents replaced
-- or removed, as `{"put": {"<path>": {"mediaType": "...", "text": "..."}},
-- "remove": ["<path>"]}`. The profile is validated at the next build, as it is
-- for every other origin.
create function profile.revise(changes jsonb, note text default null) returns bigint
language plpgsql as $$
declare
  previous_id bigint;
  new_id      bigint;
  new_digest  bytea;
  format      integer;
begin
  select h.revision_id, r.bundle_format into previous_id, format
    from profile.head h
    join profile.revision r on r.id = h.revision_id
     for no key update of h;
  if previous_id is null then
    raise exception 'the profile holds no revision yet; import a bundle before editing it in SQL';
  end if;

  create temporary table revised_document (
    path        text collate "C" primary key,
    media_type  text not null,
    blob_sha256 bytea not null
  ) on commit drop;

  insert into revised_document (path, media_type, blob_sha256)
  select d.path, d.media_type, d.blob_sha256
    from profile.document d
   where d.revision_id = previous_id
     and not (changes->'put' ? d.path)
     and d.path not in (select jsonb_array_elements_text(coalesce(changes->'remove', '[]'::jsonb)));

  insert into profile.blob (sha256, bytes)
  select pg_catalog.sha256(convert_to(put.value->>'text', 'UTF8')),
         convert_to(put.value->>'text', 'UTF8')
    from jsonb_each(coalesce(changes->'put', '{}'::jsonb)) as put
      on conflict (sha256) do nothing;

  insert into revised_document (path, media_type, blob_sha256)
  select put.key, put.value->>'mediaType', pg_catalog.sha256(convert_to(put.value->>'text', 'UTF8'))
    from jsonb_each(coalesce(changes->'put', '{}'::jsonb)) as put;

  select pg_catalog.sha256(convert_to(coalesce(string_agg(
           t.path || E'\t' || t.media_type || E'\t' || encode(t.blob_sha256, 'hex'),
           E'\n' order by t.path collate "C"), ''), 'UTF8'))
    into new_digest from revised_document t;

  insert into profile.revision (digest, bundle_format, origin, note)
  values (new_digest, format, 'sql', note) returning id into new_id;

  insert into profile.document (revision_id, path, media_type, blob_sha256)
  select new_id, path, media_type, blob_sha256 from revised_document;

  update profile.head set revision_id = new_id, updated_at = now();
  drop table revised_document;
  return new_id;
end $$;

-- The reader builds the site and reads nothing else. Every table is named, so
-- a table a later migration adds is readable only when that migration says so.
grant usage on schema profile to profile_reader;
grant select on profile.blob, profile.revision, profile.document, profile.head to profile_reader;
revoke execute on function profile.revise(jsonb, text) from public;
revoke execute on function profile.forbid_update() from public;
grant execute on function profile.digest_of(bigint) to profile_reader;
