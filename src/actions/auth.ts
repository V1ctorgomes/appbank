"use server";

import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/lib/schemas";
import { REGISTRATION_DISABLED_MESSAGE } from "@/lib/admin-contact";
import { AuthError } from "next-auth";

export async function registerUser() {
  return { error: REGISTRATION_DISABLED_MESSAGE };
}

export async function loginUser(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
  }

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    if (result && typeof result === "object" && "error" in result && result.error) {
      return { error: "E-mail ou senha incorretos" };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "E-mail ou senha incorretos" };
      }
      return { error: "Erro ao entrar. Tente novamente." };
    }
    console.error("loginUser error:", error);
    return { error: "Erro ao entrar. Tente novamente." };
  }
}

export async function logoutUser() {
  await signOut({ redirectTo: "/login" });
}
