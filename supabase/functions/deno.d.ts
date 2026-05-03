/**
 * Type declarations for Supabase Edge Functions (Deno runtime).
 * The IDE uses these; the actual runtime is Deno (Supabase).
 */

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string): SupabaseClient;
}

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

interface SupabaseQueryBuilder<T = unknown> {
  select(columns?: string): this;
  eq(column: string, value: unknown): this;
  not(column: string, op: string, value: unknown): this;
  is(column: string, value: null): this;
  in(column: string, values: unknown[]): this;
  order(column: string, opts?: { ascending?: boolean }): this;
  gte(column: string, value: string): this;
  insert(data: Record<string, unknown> | Record<string, unknown>[]): this;
  upsert(data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): this;
  update(data: Record<string, unknown>): this;
  delete(): this;
  single(): this;
  maybeSingle(): this;
  then<TResult>(onfulfilled?: (value: { data: T | null; error: { message: string } | null } | { data: T[] | null; error: { message: string } | null }) => TResult | PromiseLike<TResult>): PromiseLike<TResult>;
}

interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder;
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(url: string, key: string): SupabaseClient;
}

declare module "npm:web-push@3.6.7" {
  const webpush: {
    setVapidDetails(mailto: string, publicKey: string, privateKey: string): void;
    sendNotification(
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string
    ): Promise<unknown>;
  };
  export default webpush;
}
