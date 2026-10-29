import { z } from "zod";
export const credentialsSchema = z
  .object({
    email: z
      .string()
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const favoriteSchema = z
  .object({
    kind: z.enum(["event", "team", "athlete", "competition", "sport"]),
    target: z.string().min(1).max(150),
  })
  .strict();
export type Favorite = z.infer<typeof favoriteSchema>;
export type User = { id: string; email: string; role: "user" | "admin" };
