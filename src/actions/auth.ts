"use server";

import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/schemas";
import { AuthError } from "next-auth";

const DEFAULT_CATEGORIES = [
  { name: "Salário", type: "INCOME" as const },
  { name: "Freelance", type: "INCOME" as const },
  { name: "Presente", type: "INCOME" as const },
  { name: "Empréstimo recebido", type: "INCOME" as const },
  { name: "Mercado", type: "EXPENSE" as const },
  { name: "Aluguel", type: "EXPENSE" as const },
  { name: "Internet", type: "EXPENSE" as const },
  { name: "Gasolina", type: "EXPENSE" as const },
  { name: "Alimentação", type: "EXPENSE" as const },
];

export async function registerUser(formData: FormData) {
  try {
    const raw = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Dados inválidos" };
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return { error: "E-mail já cadastrado" };
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        categories: {
          create: DEFAULT_CATEGORIES.map((cat) => ({
            name: cat.name,
            type: cat.type,
          })),
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error("registerUser error:", error);
    return { error: "Erro ao criar conta. Tente novamente." };
  }
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
