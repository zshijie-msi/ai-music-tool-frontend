import { createBrowserRouter } from "react-router";
import { Welcome } from "./components/Welcome";
import { MelodyInput } from "./components/MelodyInput";
import { SuggestionCards } from "./components/SuggestionCards";
import { Refinement } from "./components/Refinement";
import { Result } from "./components/Result";
import { Compare } from "./components/Compare";

export const router = createBrowserRouter([
  { path: "/", Component: Welcome },
  { path: "/melody", Component: MelodyInput },
  { path: "/suggestions", Component: SuggestionCards },
  { path: "/refine", Component: Refinement },
  { path: "/result", Component: Result },
  { path: "/compare", Component: Compare },
]);
