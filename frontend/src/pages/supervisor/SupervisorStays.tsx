import SupervisorTransfers from "./SupervisorTransfers";

// "Niños que se quedan" = el supervisor mueve un estudiante de una disciplina a
// otra por una duración (solo hoy o un rango de fechas), dejando trazabilidad
// con el motivo. Reutiliza el flujo de traslados.
export default function SupervisorStays() {
  return <SupervisorTransfers />;
}
