import ExcelJS from "exceljs";

export interface ExcelColumn<T> {
  header: string;
  key: keyof T & string;
  width?: number;
}

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Genera un .xlsx en memoria con una sola hoja: cabecera en negrita,
 * fila fija y filtros automáticos. Los textos se escriben siempre como
 * texto (un RUC o un VIN no se convierten en número ni en fórmula).
 */
export async function buildXlsx<T extends object>(
  sheetName: string,
  columns: ExcelColumn<T>[],
  rows: T[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Yonda Logística";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 20,
  }));
  sheet.addRows(rows);

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Fecha de hoy en Lima (YYYY-MM-DD), para nombrar los archivos exportados. */
export function todayInLima(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" });
}
