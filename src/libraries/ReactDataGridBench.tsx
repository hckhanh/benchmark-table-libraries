import { useMemo } from "react";
import { DataGrid, type Column } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

export default function ReactDataGridBench({ data }: { data: Row[] }) {
  const columns = useMemo<Column<Row>[]>(
    () =>
      COLUMNS.map((c) => ({
        key: c.key as string,
        name: c.header,
        width: c.width,
        resizable: true,
        sortable: true,
      })),
    [],
  );

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <DataGrid
        columns={columns}
        rows={data}
        rowHeight={32}
        headerRowHeight={34}
        rowKeyGetter={(r) => r.id}
        className="rdg-light"
        style={{ height: "100%", blockSize: "100%" }}
      />
    </div>
  );
}
