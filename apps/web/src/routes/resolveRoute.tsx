import InstrumentApp from "../instrument/InstrumentApp";
import {
  AboutPage,
  ChaosPlaceholderPage,
  ContactPage,
  EssaysPage,
  FieldRecordingsPage,
  MissionPage,
  SiteHomePage,
} from "../site/pages";

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

export function resolveRoute(pathname: string) {
  const path = normalizePath(pathname);

  if (
    path === "/app" ||
    path === "/app/sky" ||
    path === "/sky" ||
    path === "/instrument"
  ) {
    return <InstrumentApp />;
  }

  if (path === "/app/chaos") return <ChaosPlaceholderPage />;
  if (path === "/about") return <AboutPage />;
  if (path === "/mission") return <MissionPage />;
  if (path === "/essays") return <EssaysPage />;
  if (path === "/field-recordings") return <FieldRecordingsPage />;
  if (path === "/contact") return <ContactPage />;

  return <SiteHomePage />;
}