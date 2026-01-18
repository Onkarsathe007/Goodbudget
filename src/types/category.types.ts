import z, { string } from "zod";

export const categorySchema = z.object({
  id: z.number().nonnegative().optional(),
  name: z.string(),
  type: z.enum(["EXPENSE", "INCOME"]),
  accountId: z.string(),
  isDefault: z.boolean().default(false),
});
