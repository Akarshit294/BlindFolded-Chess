import { LinkButton } from "@/components/ui/Button";
import { DisplayTitle, Rule } from "@/components/ui/Display";

export default function NotFound() {
  return (
    <div className="flex min-h-[64vh] flex-col items-center justify-center px-5 py-12 text-center">
      {/* A lone pawn, toppled on a melted board. */}
      <div className="relative h-44 w-72" aria-hidden="true">
        <img src="/3d/hero/light-melted-720.webp" alt="" className="theme-light-only absolute inset-0 h-full w-full scale-[1.25] object-cover [mask-image:radial-gradient(closest-side,black_60%,transparent)]" />
        <img src="/3d/hero/dark-melted-720.webp" alt="" className="theme-dark-only absolute inset-0 h-full w-full scale-[1.25] object-cover [mask-image:radial-gradient(closest-side,black_60%,transparent)]" />
        <span className="piece-sprite absolute left-1/2 top-1/2 h-40 w-40 -translate-x-[46%] -translate-y-[60%] rotate-[80deg] drop-shadow-[-10px_6px_7px_rgb(0_0_0/0.38)]" data-p="wP" />
      </div>
      <p className="mt-6 text-small font-semibold text-muted">Error 404</p>
      <DisplayTitle thin="This square" bold="is empty" size="lg" className="mt-2" />
      <Rule className="mx-auto mt-5" />
      <p className="mt-5 max-w-md text-body text-fg">The page you were looking for isn&apos;t on the board. Maybe it was captured.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/" variant="primary">
          Back to the start
        </LinkButton>
        <LinkButton href="/play?new=1">Play a game</LinkButton>
      </div>
    </div>
  );
}
