// Reusable Prisma `select` for User so passwordHash never leaves the API,
// even when a User is pulled in as a nested relation (customer, agent, actor).
export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;
