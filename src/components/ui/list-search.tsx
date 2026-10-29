import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListSearch({
  action,
  defaultValue,
  placeholder,
  hiddenFields,
  clearHref,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  hiddenFields?: Record<string, string | undefined>;
  clearHref?: string;
}) {
  const clearUrl = clearHref ?? action;

  return (
    <form action={action} method="get" className="mb-6 flex flex-wrap items-center gap-2">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) =>
          value ? <input key={name} type="hidden" name={name} value={value} /> : null
        )}
      <div className="relative min-w-[16rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          name="search"
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>
      <Button type="submit">Buscar</Button>
      {defaultValue ? (
        <Link
          href={clearUrl}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpar
        </Link>
      ) : null}
    </form>
  );
}
