import { resolveRoute } from "./routes/resolveRoute";

export default function App() {
  return resolveRoute(window.location.pathname);
}
