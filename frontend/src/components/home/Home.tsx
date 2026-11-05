import { DisplayTitle, Rule } from "@/components/ui/Display";
import { HeroActions } from "./HeroActions";
import { HeroVisual } from "./HeroVisual";
import { PuzzleShowcase } from "./PuzzleShowcase";
import { ClosingCta, InputShowcase, ModeShowcase, ProgressShowcase, TrainShowcase } from "./Showcases";

export function Home() {
  return (
    <div className="flex flex-col gap-28 pb-8 sm:gap-36">
      <section aria-labelledby="hero-title" className="grid grid-cols-1 items-center gap-8 px-5 pt-6 sm:px-8 lg:min-h-[calc(100dvh-10rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-6 lg:px-12 lg:pt-0">
        <div className="max-w-xl lg:py-10">
          <DisplayTitle id="hero-title" thin="Blindfold" bold="chess" size="xl" className="rise-in" />
          <Rule className="rise-in rise-in-1 mt-6" />
          <p className="rise-in rise-in-2 mt-6 max-w-[28rem] text-body text-fg sm:text-lead">
            Play Stockfish while the pieces fade and the board melts away. The position lives in your head; peek only when you must. Free, with no sign-up.
          </p>
          <div className="rise-in rise-in-3 mt-8">
            <HeroActions />
          </div>
        </div>
        <div className="rise-in rise-in-2 -mx-3 sm:mx-0 lg:-mr-6">
          <HeroVisual />
        </div>
      </section>
      <ModeShowcase />
      <InputShowcase />
      <TrainShowcase />
      <PuzzleShowcase />
      <ProgressShowcase />
      <ClosingCta />
    </div>
  );
}
