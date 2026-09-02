import * as XLSX from "xlsx";
import { normalizeDay, normalizeTime } from "../../utils/validators";

export interface ParsedOfferSchedule {
  diaSemana: string;
  horaInicio: string | null;
  horaFin: string | null;
  aula: string | null;
}

export interface ParsedOfferEntry {
  teacher: string;
  discipline: string;
  grades: string[];
  schedules: ParsedOfferSchedule[];
}

type SheetRow = Record<string, unknown>;

const CODE_MAP: Record<string, string> = {
  "KINDER|k4|futbol": "XC_K4_Futbol",
  "KINDER|k4|polimotor estimulacion motriz": "XC_K4_Polimotor",
  "KINDER|k4|iniciacion musical": "XC_K4_IniciaMusical",
  "KINDER|k4|iniciacion a danzas": "XC_K4_IniciaDanzas",
  "KINDER|k5|futbol": "XC_K5_Futbol",
  "KINDER|k5|polimotor estimulacion motriz": "XC_K5_Polimotor",
  "KINDER|k5|iniciacion musical": "XC_K5_IniciaMusical",
  "KINDER|k5|iniciacion a danzas": "XC_K5_IniciaDanzas",
  "PRIMARIA|4 5|entrenamiento olimpiadas matematicas": "XC_45_OlympMath",
  "PRIMARIA|1 5|artes plasticas": "XC_EL_ArtesPlasticas",
  "PRIMARIA|1 5|tecnica vocal": "XC_EL_TecVocal",
  "PRIMARIA|1|futbol": "XC_1_Futbol_M",
  "PRIMARIA|2 3|futbol": "XC_23_Futbol_M",
  "PRIMARIA|4|futbol": "XC_4_Futbol_M",
  "PRIMARIA|5|futbol": "XC_5_Futbol_M",
  "PRIMARIA|1 5|futbol femenino": "XC_EL_Futbol_F",
  "PRIMARIA|1 3|baloncesto": "XC_123_Basquetbol",
  "PRIMARIA|4 5|baloncesto": "XC_45_Basquetbol",
  "PRIMARIA|1|voleibol": "XC_1_Voleibol",
  "PRIMARIA|2 3|voleibol": "XC_23_Voleibol",
  "PRIMARIA|4 5|voleibol": "XC_45_Voleibol",
  "PRIMARIA|1 5|porras": "XC_EL_Porras",
  "PRIMARIA|1 5|porrismo": "XC_EL_Porras",
  "PRIMARIA|1 5|taekwondo": "XC_EL_Taekwondo",
  "PRIMARIA|1 5|desa instrumental": "XC_EL_DesaInstrumental",
  "PRIMARIA|1 5|desarrollo instrumental": "XC_EL_DesaInstrumental",
  "PRIMARIA|1 5|desainstrumental": "XC_EL_DesaInstrumental",
  "PRIMARIA|1 5|danza moderna": "XC_EL_DanzaModerna",
  "PRIMARIA|1 3|pequenos cientificos": "XC_EL_PequenosCientificos",
  "PRIMARIA|4 5|robo lego": "XC_Robo_Lego",
  "PRIMARIA|4 5|robotica y lego": "XC_Robo_Lego",
  "PRIMARIA|4 5|roboticaylego": "XC_Robo_Lego",
  "SECUNDARIA|6 12|robotica": "XC_SEC_ProgRobot",
  "SECUNDARIA|7|banda fireworks": "XC_SEC_BandaFW",
  "SECUNDARIA|8|banda thunder rock": "XC_MS_BandaTR",
  "SECUNDARIA|6 12|entrenamiento olimpiadas matematicas": "XC_SEC_OlympMath",
  "SECUNDARIA|6 8|futbol": "XC_MS_Futbol_M",
  "SECUNDARIA|9 12|futbol": "XC_HS_Futbol_M",
  "SECUNDARIA|6 12|futbol femenino": "XC_SEC_Futbol_F",
  "SECUNDARIA|6 8|voleibol": "XC_MS_Voleibol_F",
  "SECUNDARIA|9 12|voleibol": "XC_HS_Voleibol_F",
  "SECUNDARIA|6 12|baloncesto": "XC_SEC_Basquetbol",
  "SECUNDARIA|9 10|banda horz": "XC_90_BandaHorz",
  "SECUNDARIA|9 10|banda horizon": "XC_90_BandaHorz",
  "SECUNDARIA|6 12|artes plasticas": "XC_SEC_ArtesPlasticas",
  "SECUNDARIA|HS|banda inside": "XC_HS_BandaInside",
  "SECUNDARIA|9 12|banda inside": "XC_HS_BandaInside",
  "SECUNDARIA|HS|bandainside": "XC_HS_BandaInside",
};

function norm(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function cleanGradeToken(value: string): string {
  return norm(value)
    .replace(/°/g, "")
    .replace(/\b(1ro|1er|1era)\b/g, "1")
    .replace(/\b(2do|2da)\b/g, "2")
    .replace(/\b(3ro|3ra)\b/g, "3")
    .replace(/\b(4to|4ta)\b/g, "4")
    .replace(/\b(5to|5ta)\b/g, "5")
    .replace(/\b6to\b/g, "6")
    .replace(/\b7mo\b/g, "7")
    .replace(/\b8vo\b/g, "8")
    .replace(/\b9no\b/g, "9")
    .replace(/\b10mo\b/g, "10")
    .replace(/\b11mo\b/g, "11")
    .replace(/\b12vo\b/g, "12")
    .replace(/\bto\b/g, "")
    .replace(/\bro\b/g, "")
    .replace(/\bta\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGradeRange(raw: string): string[] {
  const grade = cleanGradeToken(raw);
  if (!grade) return [];

  if (grade.includes("k4")) return ["K4"];
  if (grade.includes("k5")) return ["K5"];
  if (grade === "hs") return ["HS"];
  if (grade === "ms") return ["MS"];

  const numbers = [...grade.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => Number.isFinite(n));
  if (numbers.length === 0) return [];

  if (numbers.length === 1) return [String(numbers[0])];

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const isRange = /\ba\b/.test(grade) || /hasta/.test(grade) || (numbers.length === 2 && max - min <= 1);
  if (isRange) {
    return Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
  }

  return [...new Set(numbers)].sort((a, b) => a - b).map(String);
}

function parseTeacherList(cells: unknown[]): string[] {
  return cells
    .flatMap((cell) => String(cell || "").split(/\n|,|\//g))
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => Boolean(value) && value !== "-");
}

function parseTimeValue(text: string, ampmHint: "am" | "pm" | null): string | null {
  const cleaned = text.replace(/\./g, ":").trim();
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || "00");
  const ampm = (match[3] || ampmHint || "").toLowerCase() as "am" | "pm" | "";
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRange(raw: string): { horaInicio: string | null; horaFin: string | null } {
  const text = norm(raw);
  if (!text || text === "-" || text.includes("segun partidos")) {
    return { horaInicio: null, horaFin: null };
  }

  const match = text.match(/(\d{1,2}:\d{2}|\d{1,2})\s*a\s*(\d{1,2}:\d{2}|\d{1,2})(?:\s*(am|pm))?/i);
  if (!match) {
    return { horaInicio: null, horaFin: null };
  }

  const suffix = (match[3] || null) as "am" | "pm" | null;
  return {
    horaInicio: parseTimeValue(match[1], suffix),
    horaFin: parseTimeValue(match[2], suffix),
  };
}

function parseScheduleCell(raw: unknown): ParsedOfferSchedule | null {
  const text = String(raw || "").trim();
  if (!text || text === "-") return null;

  const [dayPart, timePart = ""] = text.split(/\n+/);
  const diaSemana = normalizeDay(dayPart) || null;
  if (!diaSemana) return null;

  const { horaInicio, horaFin } = parseTimeRange(timePart || text);
  return { diaSemana, horaInicio, horaFin, aula: null };
}

function makeKey(sheet: string, gradeLabel: string, discipline: string): string {
  const grades = parseGradeRange(gradeLabel);
  const grade = grades.length <= 1 ? grades[0] || "" : `${grades[0]} ${grades[grades.length - 1]}`;
  return `${sheet}|${grade}|${norm(discipline)}`;
}

function pickCode(sheet: string, gradeLabel: string, discipline: string): string {
  const key = makeKey(sheet, gradeLabel, discipline);
  const code = CODE_MAP[key];
  if (!code) {
    throw new Error(`No hay código para la oferta: ${key}`);
  }
  return code;
}

function emit(sheet: string, row: SheetRow, gradeIdx: number, disciplineIdx: number, teacherIdxs: number[], scheduleIdxs: number[]): ParsedOfferEntry[] {
  const gradeLabel = String(row[gradeIdx] || "").trim();
  const discipline = String(row[disciplineIdx] || "").trim();
  if (!gradeLabel || !discipline) return [];

  const grades = parseGradeRange(gradeLabel);
  if (grades.length === 0) return [];

  const schedules = scheduleIdxs
    .map((idx) => parseScheduleCell(row[idx]))
    .filter((s): s is ParsedOfferSchedule => s !== null);

  const teachers = parseTeacherList(teacherIdxs.map((idx) => row[idx]));
  if (teachers.length === 0) return [];

  const code = pickCode(sheet, gradeLabel, discipline);
  return teachers.map((teacher) => ({ teacher, discipline: code, grades, schedules }));
}

export function parseOfferWorkbook(buffer: Buffer): ParsedOfferEntry[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const entries: ParsedOfferEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });
    for (const row of rows) {
      if (sheetName === "KINDER") {
        entries.push(...emit(sheetName, row, 0, 1, [4, 5], [2, 3]));
      } else if (sheetName === "PRIMARIA") {
        entries.push(...emit(sheetName, row, 0, 1, [5], [2, 3, 4]));
      } else if (sheetName === "SECUNDARIA") {
        entries.push(...emit(sheetName, row, 0, 1, [6], [2, 3, 4, 5]));
      }
    }
  }

  return entries;
}
