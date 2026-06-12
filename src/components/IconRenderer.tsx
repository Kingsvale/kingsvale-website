import {
  Award,
  Home,
  Leaf,
  Map as MapIcon,
  Sparkles,
  Users
} from "lucide-react";
import type { IconKey } from "../lib/contentTypes";

const iconMap = {
  award: Award,
  home: Home,
  leaf: Leaf,
  users: Users,
  map: MapIcon,
  sparkle: Sparkles
} satisfies Record<IconKey, typeof Award>;

type IconRendererProps = {
  icon: IconKey;
  className?: string;
  "aria-hidden"?: boolean;
};

export function IconRenderer({
  icon,
  className,
  "aria-hidden": ariaHidden = true
}: IconRendererProps) {
  const Icon = iconMap[icon];
  return <Icon className={className} aria-hidden={ariaHidden} strokeWidth={1.35} />;
}

export const iconOptions = [
  { value: "award", label: "Craft award" },
  { value: "home", label: "Home" },
  { value: "leaf", label: "Leaf" },
  { value: "users", label: "People" },
  { value: "map", label: "Location map" },
  { value: "sparkle", label: "Sparkle" }
] as const;
