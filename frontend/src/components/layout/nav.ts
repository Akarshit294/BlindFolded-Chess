import { IconBook, IconChart, IconKnight, IconPuzzle, IconTarget } from "@/components/ui/Icons";

export const NAV = [
  { href: "/play", label: "Play", icon: IconKnight },
  { href: "/train", label: "Train", icon: IconTarget },
  { href: "/puzzles", label: "Puzzles", icon: IconPuzzle },
  { href: "/stats", label: "Stats", icon: IconChart },
  { href: "/learn", label: "Learn", icon: IconBook },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
