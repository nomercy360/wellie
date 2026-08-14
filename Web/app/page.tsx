import type { Metadata } from "next";
import WellieApp from "./WellieApp";

export const metadata: Metadata = {
  title: "Wellie — adaptive training and nutrition coach",
  description: "Turn a real-life goal into a training and nutrition plan that adjusts to what actually happened.",
};

export default function Home() {
  return <WellieApp />;
}
