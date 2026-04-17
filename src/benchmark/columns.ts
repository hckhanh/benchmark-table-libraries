import type { Row } from "./data";

export type ColumnSpec = {
  key: keyof Row;
  header: string;
  width: number;
  type: "text" | "number" | "boolean" | "date";
};

export const COLUMNS: ColumnSpec[] = [
  { key: "id", header: "ID", width: 80, type: "number" },
  { key: "firstName", header: "First", width: 110, type: "text" },
  { key: "lastName", header: "Last", width: 110, type: "text" },
  { key: "email", header: "Email", width: 230, type: "text" },
  { key: "age", header: "Age", width: 70, type: "number" },
  { key: "country", header: "Country", width: 110, type: "text" },
  { key: "city", header: "City", width: 110, type: "text" },
  { key: "department", header: "Dept", width: 120, type: "text" },
  { key: "jobTitle", header: "Title", width: 110, type: "text" },
  { key: "salary", header: "Salary", width: 110, type: "number" },
  { key: "hireDate", header: "Hired", width: 110, type: "date" },
  { key: "active", header: "Active", width: 80, type: "boolean" },
  { key: "score", header: "Score", width: 90, type: "number" },
  { key: "projects", header: "Projects", width: 90, type: "number" },
  { key: "rating", header: "Rating", width: 80, type: "number" },
];
