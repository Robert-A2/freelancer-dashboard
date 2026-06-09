import { describe, it, expect } from "vitest";
import { parseDate, parseCsv } from "../csv-processor";

// ── parseDate ──────────────────────────────────────────────────────────────────

describe("parseDate", () => {
  it("parses ISO YYYY-MM-DD as UTC midnight", () => {
    const d = parseDate("2023-01-04");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);   // January
    expect(d!.getUTCDate()).toBe(4);
    expect(d!.getUTCHours()).toBe(0);   // midnight UTC
  });

  it("parses ISO YYYY/MM/DD as UTC midnight", () => {
    const d = parseDate("2023/01/04");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(4);
  });

  it("parses ISO datetime string, discarding time and using UTC date part", () => {
    const d = parseDate("2023-01-04T12:30:00Z");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(4);
  });

  it("parses DD/MM/YYYY (European format) as UTC midnight", () => {
    const d = parseDate("04/01/2023");   // January 4
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);   // January
    expect(d!.getUTCDate()).toBe(4);
  });

  it("parses DD-MM-YYYY as UTC midnight", () => {
    const d = parseDate("04-01-2023");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
  });

  it("parses DD.MM.YYYY as UTC midnight", () => {
    const d = parseDate("04.01.2023");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
  });

  it("falls through to MM/DD/YYYY for unambiguous US dates (day > 12)", () => {
    // "01/13/2023" — day field in DD/MM/YYYY would be month=13 (invalid), so falls through
    const d = parseDate("01/13/2023");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);   // January (month=01)
    expect(d!.getUTCDate()).toBe(13);
  });

  it("parses 'DD Mon YYYY' text format as UTC midnight", () => {
    const d = parseDate("04 Jan 2023");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(4);
  });

  it("parses 'DD January YYYY' long text as UTC midnight", () => {
    const d = parseDate("04 January 2023");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(4);
  });

  it("parses 'Mon DD, YYYY' text format as UTC midnight", () => {
    const d = parseDate("Jan 04, 2023");
    expect(d!.getUTCFullYear()).toBe(2023);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(4);
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("   ")).toBeNull();
  });

  it("returns null for gibberish", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });
});

// ── parseCsv date range ────────────────────────────────────────────────────────

function makeRow(date: string, desc: string, amount: string): string {
  return `${date},${desc},${amount}`;
}

function buildCsv(rows: string[]): string {
  return ["Date,Description,Amount", ...rows].join("\n");
}

describe("parseCsv — date range", () => {
  it("1-month: earliest and latest are both in the same month", () => {
    const csv = buildCsv([
      makeRow("2024-01-05", "Coffee",   "-5.00"),
      makeRow("2024-01-10", "Salary",  "3000.00"),
      makeRow("2024-01-28", "Rent",   "-1200.00"),
    ]);
    const { parsedEarliest, parsedLatest, transactions } = parseCsv(csv);
    expect(transactions).toHaveLength(3);
    expect(parsedEarliest!.getUTCFullYear()).toBe(2024);
    expect(parsedEarliest!.getUTCMonth()).toBe(0);     // January
    expect(parsedEarliest!.getUTCDate()).toBe(5);
    expect(parsedLatest!.getUTCMonth()).toBe(0);
    expect(parsedLatest!.getUTCDate()).toBe(28);
  });

  it("12-month: earliest is Jan, latest is Dec", () => {
    const rows = Array.from({ length: 12 }, (_, i) => {
      const month = String(i + 1).padStart(2, "0");
      return makeRow(`2023-${month}-15`, `Payment ${i + 1}`, "1000.00");
    });
    const { parsedEarliest, parsedLatest, transactions } = parseCsv(buildCsv(rows));
    expect(transactions).toHaveLength(12);
    expect(parsedEarliest!.getUTCFullYear()).toBe(2023);
    expect(parsedEarliest!.getUTCMonth()).toBe(0);    // January
    expect(parsedLatest!.getUTCFullYear()).toBe(2023);
    expect(parsedLatest!.getUTCMonth()).toBe(11);     // December
  });

  it("24-month: spans two full years", () => {
    const rows: string[] = [];
    for (let y = 2022; y <= 2023; y++) {
      for (let m = 1; m <= 12; m++) {
        const month = String(m).padStart(2, "0");
        rows.push(makeRow(`${y}-${month}-10`, `Payment`, "500.00"));
      }
    }
    const { parsedEarliest, parsedLatest, transactions } = parseCsv(buildCsv(rows));
    expect(transactions).toHaveLength(24);
    expect(parsedEarliest!.getUTCFullYear()).toBe(2022);
    expect(parsedEarliest!.getUTCMonth()).toBe(0);
    expect(parsedLatest!.getUTCFullYear()).toBe(2023);
    expect(parsedLatest!.getUTCMonth()).toBe(11);
  });

  it("36-month: spans three full years", () => {
    const rows: string[] = [];
    for (let y = 2021; y <= 2023; y++) {
      for (let m = 1; m <= 12; m++) {
        const month = String(m).padStart(2, "0");
        rows.push(makeRow(`${y}-${month}-01`, `Expense`, "-200.00"));
      }
    }
    const { parsedEarliest, parsedLatest, transactions } = parseCsv(buildCsv(rows));
    expect(transactions).toHaveLength(36);
    expect(parsedEarliest!.getUTCFullYear()).toBe(2021);
    expect(parsedEarliest!.getUTCMonth()).toBe(0);
    expect(parsedLatest!.getUTCFullYear()).toBe(2023);
    expect(parsedLatest!.getUTCMonth()).toBe(11);
  });

  it("reported scenario: Jan 2023 – Jan 2024 CSV shows correct range", () => {
    const rows: string[] = [];
    // First transaction: Jan 4, 2023
    rows.push(makeRow("2023-01-04", "Opening balance", "500.00"));
    // Fill in monthly payments Jan 2023 – Jan 2024
    for (let m = 1; m <= 12; m++) {
      const month = String(m).padStart(2, "0");
      rows.push(makeRow(`2023-${month}-15`, `Income`, "2000.00"));
    }
    // Last transaction: Jan 28, 2024
    rows.push(makeRow("2024-01-28", "Income", "2000.00"));

    const { parsedEarliest, parsedLatest } = parseCsv(buildCsv(rows));

    expect(parsedEarliest!.getUTCFullYear()).toBe(2023);
    expect(parsedEarliest!.getUTCMonth()).toBe(0);    // January 2023
    expect(parsedLatest!.getUTCFullYear()).toBe(2024);
    expect(parsedLatest!.getUTCMonth()).toBe(0);      // January 2024
  });

  it("January 1st transaction never shifts to December of previous year", () => {
    // January 1st at UTC midnight is the classic timezone trap:
    // UTC-1 would show Dec 31 of the previous year
    const csv = buildCsv([
      makeRow("2023-01-01", "New Year payment", "100.00"),
    ]);
    const { parsedEarliest } = parseCsv(csv);
    expect(parsedEarliest!.getUTCFullYear()).toBe(2023);
    expect(parsedEarliest!.getUTCMonth()).toBe(0);    // still January
    expect(parsedEarliest!.getUTCDate()).toBe(1);
  });
});
