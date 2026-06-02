export const PAGE_SIZE = 10;

export function parsePage(page?: string | number): number {
  const value = typeof page === "string" ? parseInt(page, 10) : page ?? 1;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getPagination(page?: string | number) {
  const currentPage = parsePage(page);
  const skip = (currentPage - 1) * PAGE_SIZE;
  return { currentPage, skip, take: PAGE_SIZE };
}

export function getTotalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}
