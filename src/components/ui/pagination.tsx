import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

function buildPageUrl(
  basePath: string,
  page: number,
  searchParams?: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  searchParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
      aria-label="Paginação"
    >
      <p className="text-sm text-slate-500">
        Página {currentPage} de {totalPages}
      </p>
      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Link
            href={buildPageUrl(basePath, currentPage - 1, searchParams)}
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-300">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </span>
        )}

        {pages.map((page) => (
          <Link
            key={page}
            href={buildPageUrl(basePath, page, searchParams)}
            className={cn(
              "min-w-[2.25rem] rounded-lg border px-3 py-1.5 text-center text-sm font-medium",
              page === currentPage
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            )}
          >
            {page}
          </Link>
        ))}

        {currentPage < totalPages ? (
          <Link
            href={buildPageUrl(basePath, currentPage + 1, searchParams)}
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-300">
            Próxima
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
