import "../app/globals.css";
import { Composition } from "remotion";
import { loadFont as loadQuestrial } from "@remotion/google-fonts/Questrial";
import { loadFont as loadTajawal } from "@remotion/google-fonts/Tajawal";
import { AppShowcase, SHOWCASE_FPS, SHOWCASE_FRAMES, type AppShowcaseProps } from "./showcase/AppShowcase";
import { RouteJourney, ROUTE_FPS, ROUTE_FRAMES, type RouteJourneyProps } from "./route/RouteJourney";

// Same fallbacks the app uses when Century Gothic isn't installed (next/font isn't available here).
const geo = loadQuestrial();
const tajawal = loadTajawal("normal", { weights: ["400", "500", "700"], subsets: ["arabic"] });
if (typeof document !== "undefined") {
  document.documentElement.style.setProperty("--font-geo", geo.fontFamily);
  document.documentElement.style.setProperty("--font-tajawal", tajawal.fontFamily);
}

const sampleCars: AppShowcaseProps["cars"] = [
  { id: "1", make: "Dacia", model: "Logan", year: 2022, cover_url: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=600&q=70", daily_price_mad: 280, rating: 4.8, review_count: 12 },
  { id: "2", make: "Hyundai", model: "Accent", year: 2021, cover_url: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=600&q=70", daily_price_mad: 350, rating: 4.7, review_count: 9 },
  { id: "3", make: "Toyota", model: "RAV4", year: 2023, cover_url: "https://images.unsplash.com/photo-1617469767053-d3b523a0b982?auto=format&fit=crop&w=600&q=70", daily_price_mad: 620, rating: 4.9, review_count: 21 },
];

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="AppShowcase"
        component={AppShowcase}
        durationInFrames={SHOWCASE_FRAMES}
        fps={SHOWCASE_FPS}
        width={1920}
        height={1080}
        defaultProps={{ locale: "fr", cars: sampleCars, city: "Casablanca", hostName: "Youssef El Amrani", layout: "wide" } satisfies AppShowcaseProps}
      />
      <Composition
        id="AppShowcaseTall"
        component={AppShowcase}
        durationInFrames={SHOWCASE_FRAMES}
        fps={SHOWCASE_FPS}
        width={1080}
        height={1350}
        defaultProps={{ locale: "fr", cars: sampleCars, city: "Casablanca", hostName: "Youssef El Amrani", layout: "tall" } satisfies AppShowcaseProps}
      />
      <Composition
        id="RouteJourney"
        component={RouteJourney}
        durationInFrames={ROUTE_FRAMES}
        fps={ROUTE_FPS}
        width={1920}
        height={1080}
        defaultProps={{ locale: "fr", token: "", counts: {}, names: {} } satisfies RouteJourneyProps}
      />
    </>
  );
}
