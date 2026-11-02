export const COUNTERTOP_FINISH_VARIANTS = [
  { id: "default", label: "Light oak" },
  { id: "dark-oak", label: "Dark oak" },
  { id: "white-marble", label: "White marble" },
  { id: "black-granite", label: "Black granite" },
  { id: "white-quartz", label: "White quartz" },
  { id: "concrete", label: "Concrete" },
];

export function countertopFinish(variant: string) {
  switch (variant) {
    case "dark-oak":
      return { color: "#795237", detail: "#67442f", outline: "#543b2c", pattern: "grain" };
    case "white-marble":
      return { color: "#eeeae2", detail: "#b8b6b0", outline: "#a3a098", pattern: "veins" };
    case "black-granite":
      return { color: "#333637", detail: "#656866", outline: "#252929", pattern: "flecks" };
    case "white-quartz":
      return { color: "#f0ede5", detail: "#d7d1c5", outline: "#b7b0a3", pattern: "flecks" };
    case "concrete":
      return { color: "#aaa8a0", detail: "#a09e96", outline: "#767770", pattern: "flecks" };
    default:
      return { color: "#d3b17d", detail: "#bd985f", outline: "#a1845b", pattern: "grain" };
  }
}
