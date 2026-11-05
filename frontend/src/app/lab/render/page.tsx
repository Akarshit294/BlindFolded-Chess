import { notFound } from "next/navigation";
import { RenderLabClient } from "./RenderLabClient";

/** Development-only render lab for scripts/render-3d.mjs (404 in production builds). */
export default function RenderLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RenderLabClient />;
}
