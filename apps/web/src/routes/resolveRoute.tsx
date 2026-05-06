import InstrumentApp from "../instrument/InstrumentApp";
import { AboutPage, ChaosPlaceholderPage, EssaysPage, FieldRecordingsPage, SiteHomePage } from "../site/pages";

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

export function resolveRoute(pathname: string) {
  const path = normalizePath(pathname);

  if (path === "/app" || path === "/app/sky" || path === "/sky" || path === "/instrument") {
    return <InstrumentApp />;
  }

  if (path === "/app/chaos") return <ChaosPlaceholderPage />;
  if (path === "/about") return <AboutPage />;
  if (path === "/field-recordings") return <FieldRecordingsPage />;
  if (path === "/essays") return <EssaysPage />;

  return <SiteHomePage />;
}
