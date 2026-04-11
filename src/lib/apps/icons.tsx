import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  Eye,
  LayoutDashboard,
  PlayCircle,
  Rocket,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

const APP_ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  ArrowLeftRight,
  Bell,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  Eye,
  LayoutDashboard,
  PlayCircle,
  Rocket,
  Store,
  TrendingUp,
  Users,
};

export function resolveAppIcon(name: string): LucideIcon {
  return APP_ICON_MAP[name] ?? Store;
}
