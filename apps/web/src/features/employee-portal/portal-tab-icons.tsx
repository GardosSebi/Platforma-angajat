import type { ReactNode } from "react";
import { NavIcons } from "../../app/nav-icons";
import type { EmployeePortalTab } from "./utils";

export const PORTAL_TAB_ICONS: Record<EmployeePortalTab, () => ReactNode> = {
  home: () => NavIcons.home(),
  trainings: () => NavIcons.trainings(),
  documents: () => NavIcons.documents(),
  dossier: () => NavIcons.dossier(),
  medical: () => NavIcons.medical(),
  announcements: () => NavIcons.announcements(),
  surveys: () => NavIcons.surveys(),
  tickets: () => NavIcons.tickets()
};
