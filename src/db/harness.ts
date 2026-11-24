import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/**
 * Policy-level test harness: runs the REAL migrations in an in-process Postgres (PGlite) with
 * minimal stand-ins for the Supabase pieces the migrations rely on (roles, auth.users,
 * auth.uid(), storage.buckets). Nothing here talks to a Supabase project.
 */
const SUPABASE_PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create schema extensions;
  create schema storage;

  create table auth.users (id uuid primary key default gen_random_uuid(), email text);

  -- Same behaviour as Supabase: the user id is the "sub" claim of the request's JWT.
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;

  -- Supabase's stock grants, which the migrations then tighten.
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
  grant usage on schema storage to anon, authenticated, service_role;
`;

export type Role = "anon" | "authenticated" | "service_role";

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_PRELUDE);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

/**
 * Run `fn` the way PostgREST would: as `role`, with `userId` as the JWT subject. The whole
 * call is one transaction that is rolled back afterwards, so a rejected statement can never
 * poison the next test and nothing the callback writes is kept.
 */
export async function as<T>(
  db: PGlite,
  role: Role,
  userId: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  class Rollback extends Error {
    constructor(readonly value: T) {
      super("rollback");
    }
  }
  try {
    await db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(userId ? { sub: userId, role } : { role }),
      ]);
      throw new Rollback(await fn(tx));
    });
  } catch (error) {
    if (error instanceof Rollback) return error.value;
    throw error;
  }
  throw new Error("unreachable");
}
