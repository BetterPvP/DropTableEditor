"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createActionClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  invite: z.string().min(4),
});

export type SignUpResult = { error?: string };

export async function signUpAction(_: SignUpResult, formData: FormData): Promise<SignUpResult> {
  const data = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    invite: formData.get("invite"),
  });

  if (!data.success) {
    return { error: "Please fill out all fields with valid information." };
  }

  const supabase = createActionClient();
  const { data: inviteRecord, error: inviteError } = await supabase
    .from("invite_codes")
    .select("code, used_by, role")
    .eq("code", data.data.invite)
    .maybeSingle();

  if (inviteError) {
    return { error: inviteError.message };
  }

  if (!inviteRecord) {
    return { error: "Invalid invite code." };
  }

  if (inviteRecord.used_by) {
    return { error: "This invite code has already been used." };
  }

  const { data: auth, error } = await supabase.auth.signUp({
    email: data.data.email,
    password: data.data.password,
    options: {
      data: { role: inviteRecord.role ?? "admin" },
    },
  });

  if (error || !auth.user) {
    return { error: error?.message ?? "Unable to complete signup." };
  }

  await supabase
    .from("invite_codes")
    .update({ used_by: auth.user.id, used_at: new Date().toISOString() })
    .eq("code", inviteRecord.code);

  redirect("/loot-tables");
}
