import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "./types";

export function createServerClient() {
  const cookieStore = cookies();
  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
  });
}

export function createActionClient() {
  const cookieStore = cookies();
  return createServerActionClient<Database>({
    cookies: () => cookieStore,
  });
}
