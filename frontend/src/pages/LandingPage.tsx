import { CinematicFrameSequence } from "../components/CinematicFrameSequence";
import "../styles/landing.css";

interface Props {
  onEnterApp: () => void;
  onGuestLogin?: () => void;
}

export function LandingPage({ onEnterApp, onGuestLogin }: Props) {
  return (
    <main className="cinematic-landing">
      <CinematicFrameSequence
        totalFrames={240}
        onEnterApp={onEnterApp}
        onGuestLogin={onGuestLogin}
      />
    </main>
  );
}

