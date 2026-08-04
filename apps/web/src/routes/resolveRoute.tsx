import InstrumentApp from "../instrument/InstrumentApp";
import { AboutPage, ChaosPlaceholderPage, ContactPage, EssaysPage, FieldRecordingsPage, ProjectsPage, SiteHomePage } from "../site/pages";

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

export function resolveRoute(pathname: string) {
  const path = normalizePath(pathname);

  if (path === "/app" || path === "/app/sky" || path === "/sky" || path === "/instrument") {
    return <InstrumentApp />;
  }

  if (path === "/app/chaos") return <ChaosPlaceholderPage />;
  if (path === "/about") return <AboutPage />;
  if (path === "/contact") return <ContactPage />;
  if (path === "/projects") return <ProjectsPage />;
  if (path === "/projects/field-recordings" || path === "/field-recordings") return <FieldRecordingsPage />;
  if (path === "/projects/essays" || path === "/essays") return <EssaysPage />;

  return <SiteHomePage />;
}
