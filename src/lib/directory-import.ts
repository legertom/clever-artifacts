import "server-only";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isAllowedEmail, normalizeEmail } from "@/lib/config";

export type DirectoryRow = {
  email: string;
  name: string | null;
  title: string | null;
  department: string | null;
  managerEmail: string | null;
};

const HEADERS = {
  email: ["email", "e-mail", "work email", "email address", "mail"],
  name: ["name", "full name", "display name", "employee", "employee name"],
  first: ["first name", "first", "given name"],
  last: ["last name", "last", "surname", "family name"],
  title: ["title", "job title", "role", "position"],
  department: ["department", "dept", "team", "org", "function"],
  managerEmail: ["manager email", "manager e-mail", "manager's email", "reports to email", "supervisor email", "manager_email"],
};

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as { text?: unknown; richText?: { text: string }[]; result?: unknown; hyperlink?: string };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
    if (o.result !== undefined) return cellText(o.result);
    if (typeof o.hyperlink === "string") return o.hyperlink.replace(/^mailto:/i, "");
    return "";
  }
  return String(v);
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

async function readTable(buffer: Buffer, filename: string): Promise<string[][]> {
  if (/\.csv$/i.test(filename)) return parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1).map(cellText));
  });
  return rows;
}

function findColumn(header: string[], names: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const i = norm.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

/** Rows with an allowed-domain email; everything else is counted as skipped. */
export async function parseDirectory(
  buffer: Buffer,
  filename: string,
): Promise<{ rows: DirectoryRow[]; skipped: number; columns: string[] }> {
  const table = await readTable(buffer, filename);
  if (!table.length) return { rows: [], skipped: 0, columns: [] };
  const header = table[0];
  const col = {
    email: findColumn(header, HEADERS.email),
    name: findColumn(header, HEADERS.name),
    first: findColumn(header, HEADERS.first),
    last: findColumn(header, HEADERS.last),
    title: findColumn(header, HEADERS.title),
    department: findColumn(header, HEADERS.department),
    managerEmail: findColumn(header, HEADERS.managerEmail),
  };
  if (col.email < 0) throw new Error(`Couldn't find an email column. Headers seen: ${header.join(", ")}`);

  const seen = new Set<string>();
  const rows: DirectoryRow[] = [];
  let skipped = 0;
  for (const r of table.slice(1)) {
    const email = normalizeEmail(r[col.email] ?? "");
    if (!email || !isAllowedEmail(email) || seen.has(email)) {
      if (email) skipped++;
      continue;
    }
    seen.add(email);
    const name =
      (col.name >= 0 && r[col.name]?.trim()) ||
      [col.first >= 0 ? r[col.first] : "", col.last >= 0 ? r[col.last] : ""].map((x) => (x ?? "").trim()).filter(Boolean).join(" ") ||
      null;
    rows.push({
      email,
      name: name ? name.slice(0, 120) : null,
      title: col.title >= 0 ? (r[col.title]?.trim().slice(0, 120) ?? null) || null : null,
      department: col.department >= 0 ? (r[col.department]?.trim().slice(0, 120) ?? null) || null : null,
      managerEmail: (() => {
        const m = col.managerEmail >= 0 ? normalizeEmail(r[col.managerEmail] ?? "") : "";
        return m && isAllowedEmail(m) && m !== email ? m : null;
      })(),
    });
  }
  return { rows, skipped, columns: header };
}

/**
 * Insert new people (no login yet) and refresh title/department on existing
 * ones. A name someone already has from Google is kept.
 */
export async function upsertDirectory(rows: DirectoryRow[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const result = await db
      .insert(users)
      .values(
        chunk.map((r) => ({
          email: r.email,
          name: r.name,
          title: r.title,
          department: r.department,
          managerEmail: r.managerEmail,
          lastLoginAt: null,
        })),
      )
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: sql`coalesce(${users.name}, excluded.name)`,
          title: sql`coalesce(excluded.title, ${users.title})`,
          department: sql`coalesce(excluded.department, ${users.department})`,
          managerEmail: sql`coalesce(excluded.manager_email, ${users.managerEmail})`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    for (const r of result) if (r.inserted) inserted++; else updated++;
  }
  return { inserted, updated };
}
