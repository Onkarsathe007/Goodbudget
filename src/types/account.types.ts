import z, { boolean, string } from "zod";

export const accountSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  name: z.string(),
  initialBalance: z.number().nonnegative(),
  currentBalance: z.number().nonnegative(),
  type: z.enum(["CASH", "BANK", "WALLET"]),
  isDefault: z.boolean().default(false),
});
