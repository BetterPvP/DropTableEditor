"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createActionClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type SignInResult = { error?: string };

export async function signInAction(_: SignInResult, formData: FormData): Promise<SignInResult> {
  const data = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!data.success) {
    return { error: "Please provide a valid email and password." };
  }

  const supabase = createActionClient();
  const { error } = await supabase.auth.signInWithPassword({ email: data.data.email, password: data.data.password });

  if (error) {
    return { error: error.message };
  }

  redirect("/loot-tables");
}
