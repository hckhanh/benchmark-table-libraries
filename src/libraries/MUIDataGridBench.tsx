import { useMemo } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

export default function MUIDataGridBench({ data }: { data: Row[] }) {
  const columns = useMemo<GridColDef<Row>[]>(
    () =>
      COLUMNS.map((c) => ({
        field: c.key as string,
        headerName: c.header,
        width: c.width,
        sortable: true,
        type:
          c.type === "number"
            ? "number"
            : c.type === "boolean"
              ? "boolean"
              : c.type === "date"
                ? "date"
                : "string",
        valueGetter:
          c.type === "date" ? (value: string) => (value ? new Date(value) : null) : undefined,
      })),
    [],
  );

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <DataGrid
        rows={data}
        columns={columns}
        density="compact"
        rowHeight={32}
        columnHeaderHeight={34}
        disableColumnMenu
        disableRowSelectionOnClick
        getRowId={(r) => r.id}
        pagination
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 100, page: 0 } } }}
      />
    </div>
  );
}
