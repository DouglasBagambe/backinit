import { z } from "zod";
export const remoteEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["athlete", "team"]),
  sport: z.string(),
  providerSport: z.string(),
  league: z.string(),
  image: z.string().optional(),
});
export type RemoteEntity = z.infer<typeof remoteEntitySchema>;
export const searchResultSchema = z.object({
  data: z.array(remoteEntitySchema),
  partial: z.boolean().optional(),
});
export const athleteProfileSchema = z.object({
  value: z.object({
    id: z.string(),
    name: z.string(),
    sport: z.string(),
    position: z.string().optional(),
    team: z.object({ id: z.string(), displayName: z.string() }).optional(),
    image: z.string().optional(),
    height: z.string().optional(),
    weight: z.string().optional(),
    birthDate: z.string().optional(),
    age: z.number().optional(),
    jersey: z.string().optional(),
    country: z.string().optional(),
    appearances: z
      .array(
        z.object({
          id: z.string(),
          date: z.string(),
          opponent: z.string(),
          atVs: z.string(),
          team: z.string().optional(),
          score: z.string().optional(),
          result: z.string().optional(),
          statistics: z.array(
            z.object({ label: z.string(), value: z.string() }),
          ),
        }),
      )
      .default([]),
    statistics: z
      .object({
        displayName: z.string(),
        statistics: z.array(
          z.object({ displayName: z.string(), displayValue: z.string() }),
        ),
      })
      .optional(),
  }),
  stale: z.boolean(),
  fetchedAt: z.string(),
});
