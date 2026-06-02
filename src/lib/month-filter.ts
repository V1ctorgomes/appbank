import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function parseMonthFilter(month?: string) {
  const now = new Date();
  let year = now.getFullYear();
  let monthIndex = now.getMonth();

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    year = y;
    monthIndex = m - 1;
  }

  const start = startOfMonth(new Date(year, monthIndex, 1));
  const end = endOfMonth(start);

  return {
    start,
    end,
    key: format(start, "yyyy-MM"),
    label: format(start, "MMMM 'de' yyyy", { locale: ptBR }),
  };
}
