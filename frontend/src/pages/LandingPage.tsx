import { CinematicFrameSequence } from "../components/CinematicFrameSequence";
import "../styles/landing.css";

interface Props {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: Props) {
  return (
    <main className="cinematic-landing">
      <CinematicFrameSequence totalFrames={240} onEnterApp={onEnterApp} />
    </main>
  );
}
