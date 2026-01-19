import z from "zod";

export const expenseSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  accountId: z.string(),
  categoryId: z.number().nonnegative(),
  title: z.string().nullable(),
  note: z.string().nullable(),
  amount: z.number().nonnegative(),
  type: z.enum(["BANK", "CASH", "WALLET"]),
});
