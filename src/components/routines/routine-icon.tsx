import {
  Target,
  Coffee,
  Zap,
  Dumbbell,
  BookOpen,
  Briefcase,
  HeartPulse,
  Pill,
  Laptop,
  DollarSign,
  Utensils,
  Pin,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";

interface RoutineIconProps {
  name?: string | null;
  type?: string;
  isAdHoc?: boolean;
  className?: string;
}

export function RoutineIcon({ name, type, isAdHoc, className = "h-4 w-4" }: RoutineIconProps) {
  if (isAdHoc || name === "zap" || name === "⚡") {
    return <Zap className={className} />;
  }

  if (type === "BREAK_REST" || name === "coffee" || name === "☕") {
    return <Coffee className={className} />;
  }

  switch (name) {
    case "dumbbell":
    case "🏋️":
      return <Dumbbell className={className} />;
    case "book":
    case "📚":
      return <BookOpen className={className} />;
    case "briefcase":
    case "💼":
      return <Briefcase className={className} />;
    case "health":
    case "🧘":
      return <HeartPulse className={className} />;
    case "pill":
    case "💊":
      return <Pill className={className} />;
    case "laptop":
    case "💻":
      return <Laptop className={className} />;
    case "dollar":
    case "💵":
      return <DollarSign className={className} />;
    case "food":
    case "🍏":
      return <Utensils className={className} />;
    case "target":
    case "🎯":
      return <Target className={className} />;
    case "pin":
    case "📌":
      return <Pin className={className} />;
    default:
      if (type === "ACTIVITY") return <Target className={className} />;
      return <Pin className={className} />;
  }
}

export const ICON_OPTIONS = [
  { id: "pin", label: "Geral", icon: Pin },
  { id: "target", label: "Foco / Meta", icon: Target },
  { id: "coffee", label: "Pausa / Descanso", icon: Coffee },
  { id: "dumbbell", label: "Exercício / Treino", icon: Dumbbell },
  { id: "book", label: "Estudos / Leitura", icon: BookOpen },
  { id: "briefcase", label: "Trabalho", icon: Briefcase },
  { id: "laptop", label: "Tecnologia / PC", icon: Laptop },
  { id: "health", label: "Saúde / Bem-estar", icon: HeartPulse },
  { id: "pill", label: "Medicamentos", icon: Pill },
  { id: "dollar", label: "Finanças", icon: DollarSign },
  { id: "food", label: "Alimentação", icon: Utensils },
  { id: "zap", label: "Imprevisto", icon: Zap },
];
