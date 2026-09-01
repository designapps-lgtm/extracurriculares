import SupervisorTransfers from "./SupervisorTransfers";
import type { RoleKind } from "../../services/roles";

// "Niños que se quedan" = el supervisor mueve un estudiante de una disciplina a
// otra por una duración (solo hoy o un rango de fechas), dejando trazabilidad
// con el motivo. Reutiliza el flujo de traslados.
export interface PageProps {
  role?: RoleKind;
}

export default function SupervisorStays({ role = "supervisor" }: PageProps) {
  return <SupervisorTransfers role={role} />;
}
