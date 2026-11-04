import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="font-mono text-sm text-ember-300">404</div>
      <h1 className="mt-3 text-4xl font-semibold text-ivory-50">This square is empty.</h1>
      <p className="mt-3 text-ivory-400">The page you were looking for isn&apos;t on the board. Maybe it was captured.</p>
      <div className="mt-8">
        <LinkButton href="/" variant="primary">
          Back to the start
        </LinkButton>
      </div>
    </div>
  );
}
