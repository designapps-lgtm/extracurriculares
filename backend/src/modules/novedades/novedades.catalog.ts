export type NovedadFamily =
  | "salida_ausencia"
  | "salud"
  | "disciplina_convivencia"
  | "apoyo_escolar"
  | "actividad"
  | "traslado"
  | "informativa"
  | "otra";

export type NovedadField =
  | "descripcion"
  | "motivo"
  | "acompanante"
  | "autorizado"
  | "regreso"
  | "seguimiento"
  | "procesado"
  | "grado";

export interface NovedadFlowStep {
  key: string;
  label: string;
}

export interface NovedadPresentation {
  typeKey: string;
  typeLabel: string;
  familyKey: NovedadFamily;
  familyLabel: string;
  flowKey: string;
  flowLabel: string;
  flowSteps: NovedadFlowStep[];
  visibleFields: NovedadField[];
  attendanceEffect: "none";
}

interface CatalogRule {
  familyKey: NovedadFamily;
  familyLabel: string;
  aliases: string[];
  defaultFlowKey: string;
  defaultFlowLabel: string;
  flowSteps: NovedadFlowStep[];
  visibleFields: NovedadField[];
}

const RULES: CatalogRule[] = [
  {
    familyKey: "salida_ausencia",
    familyLabel: "Salida o ausencia",
    aliases: ["salida", "ausencia", "ausente", "se ausenta", "retiro", "retira", "permiso", "recogida", "transporte", "no asiste"],
    defaultFlowKey: "validar_salida",
    defaultFlowLabel: "Validar salida y hacer seguimiento",
    flowSteps: [
      { key: "registrada", label: "Novedad registrada" },
      { key: "autorizacion", label: "Validar autorización" },
      { key: "salida", label: "Confirmar salida" },
      { key: "regreso", label: "Hacer seguimiento al regreso" },
    ],
    visibleFields: ["descripcion", "motivo", "acompanante", "autorizado", "regreso"],
  },
  {
    familyKey: "salud",
    familyLabel: "Salud y bienestar",
    aliases: ["salud", "enfermedad", "enfermo", "enfermeria", "medico", "medica", "accidente", "malestar"],
    defaultFlowKey: "atencion_salud",
    defaultFlowLabel: "Atender y hacer seguimiento",
    flowSteps: [
      { key: "registrada", label: "Novedad registrada" },
      { key: "atencion", label: "Coordinar atención" },
      { key: "autorizacion", label: "Validar autorización" },
      { key: "seguimiento", label: "Hacer seguimiento" },
    ],
    visibleFields: ["descripcion", "motivo", "autorizado", "seguimiento", "regreso"],
  },
  {
    familyKey: "disciplina_convivencia",
    familyLabel: "Disciplina y convivencia",
    aliases: ["disciplina", "convivencia", "comportamiento", "conducta", "incidente", "reporte disciplinario"],
    defaultFlowKey: "gestion_convivencia",
    defaultFlowLabel: "Registrar y gestionar convivencia",
    flowSteps: [
      { key: "registrada", label: "Novedad registrada" },
      { key: "revision", label: "Revisar el caso" },
      { key: "comunicacion", label: "Comunicar a los responsables" },
      { key: "seguimiento", label: "Hacer seguimiento" },
    ],
    visibleFields: ["descripcion", "motivo", "autorizado", "procesado", "seguimiento"],
  },
  {
    familyKey: "apoyo_escolar",
    familyLabel: "Apoyo escolar",
    aliases: ["apoyo escolar", "apoyo academico", "refuerzo", "acompanamiento escolar", "acompanamiento academico"],
    defaultFlowKey: "coordinar_apoyo",
    defaultFlowLabel: "Coordinar apoyo escolar",
    flowSteps: [
      { key: "registrada", label: "Novedad registrada" },
      { key: "coordinacion", label: "Coordinar apoyo" },
      { key: "comunicacion", label: "Informar a los responsables" },
      { key: "seguimiento", label: "Hacer seguimiento" },
    ],
    visibleFields: ["descripcion", "motivo", "grado", "autorizado", "seguimiento"],
  },
  {
    familyKey: "actividad",
    familyLabel: "Actividad o evento",
    aliases: ["deporte", "actividad", "evento", "competencia", "torneo", "salida pedagogica", "excursion"],
    defaultFlowKey: "coordinar_actividad",
    defaultFlowLabel: "Coordinar actividad o evento",
    flowSteps: [
      { key: "registrada", label: "Novedad registrada" },
      { key: "coordinacion", label: "Coordinar actividad" },
      { key: "autorizacion", label: "Validar autorización" },
      { key: "cierre", label: "Registrar cierre" },
    ],
    visibleFields: ["descripcion", "motivo", "grado", "autorizado", "procesado"],
  },
  {
    familyKey: "traslado",
    familyLabel: "Traslado o cambio",
    aliases: ["traslado", "cambio de grupo", "cambio de disciplina", "cambio de actividad", "transferencia"],
    defaultFlowKey: "validar_traslado",
    defaultFlowLabel: "Validar y registrar traslado",
    flowSteps: [
      { key: "registrada", label: "Novedad registrada" },
      { key: "revision", label: "Revisar solicitud" },
      { key: "autorizacion", label: "Validar autorización" },
      { key: "cierre", label: "Registrar cambio" },
    ],
    visibleFields: ["descripcion", "motivo", "grado", "autorizado", "procesado"],
  },
];

const INFORMATIVE_RULE: CatalogRule = {
  familyKey: "informativa",
  familyLabel: "Información general",
  aliases: [],
  defaultFlowKey: "informar",
  defaultFlowLabel: "Informar y dejar registro",
  flowSteps: [
    { key: "registrada", label: "Novedad registrada" },
    { key: "comunicacion", label: "Informar a los responsables" },
    { key: "cierre", label: "Dejar registro" },
  ],
  visibleFields: ["descripcion", "motivo", "grado", "autorizado", "procesado"],
};

const OTHER_RULE: CatalogRule = {
  familyKey: "otra",
  familyLabel: "Otro tipo de novedad",
  aliases: [],
  defaultFlowKey: "revisar_novedad",
  defaultFlowLabel: "Revisar y definir seguimiento",
  flowSteps: [
    { key: "registrada", label: "Novedad registrada" },
    { key: "revision", label: "Revisar la novedad" },
    { key: "seguimiento", label: "Definir seguimiento" },
  ],
  visibleFields: ["descripcion", "motivo", "grado", "autorizado", "procesado", "seguimiento"],
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function key(value: string, fallback: string): string {
  const result = normalize(value).replace(/ /g, "_");
  return result || fallback;
}

function findRule(type: string, flow: string): CatalogRule {
  const source = normalize(`${type} ${flow}`);
  return RULES.find((rule) => rule.aliases.some((alias) => source.includes(normalize(alias)))) || (type ? OTHER_RULE : INFORMATIVE_RULE);
}

export function presentNovedad(input: {
  tipoNovedad?: string | null;
  flujoNovedad?: string | null;
}): NovedadPresentation {
  const type = String(input.tipoNovedad || "").trim();
  const flow = String(input.flujoNovedad || "").trim();
  const rule = findRule(type, flow);

  return {
    typeKey: key(type, rule.familyKey === "informativa" ? "sin_tipo" : "otro_tipo"),
    typeLabel: type || "Sin tipo definido",
    familyKey: rule.familyKey,
    familyLabel: rule.familyLabel,
    flowKey: key(flow, rule.defaultFlowKey),
    flowLabel: flow || rule.defaultFlowLabel,
    flowSteps: rule.flowSteps,
    visibleFields: rule.visibleFields,
    attendanceEffect: "none",
  };
}

export function listNovedadCatalog(): NovedadPresentation[] {
  return [...RULES, INFORMATIVE_RULE, OTHER_RULE].map((rule) => ({
    typeKey: rule.familyKey,
    typeLabel: rule.familyLabel,
    familyKey: rule.familyKey,
    familyLabel: rule.familyLabel,
    flowKey: rule.defaultFlowKey,
    flowLabel: rule.defaultFlowLabel,
    flowSteps: rule.flowSteps,
    visibleFields: rule.visibleFields,
    attendanceEffect: "none",
  }));
}
