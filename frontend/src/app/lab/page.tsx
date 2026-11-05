import { notFound } from "next/navigation";
import { BoardLab } from "@/components/board/BoardLab";

/** Development-only playground for board animations (404 in production builds). */
export default function LabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BoardLab />;
}
