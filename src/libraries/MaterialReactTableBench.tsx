import { useMemo } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

export default function MaterialReactTableBench({ data }: { data: Row[] }) {
  const columns = useMemo<MRT_ColumnDef<Row>[]>(
    () =>
      COLUMNS.map((c) => ({
        accessorKey: c.key as string,
        header: c.header,
        size: c.width,
      })),
    [],
  );

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <MaterialReactTable
        columns={columns}
        data={data}
        enableRowVirtualization
        enableColumnVirtualization
        enablePagination={false}
        enableBottomToolbar={false}
        enableTopToolbar={false}
        enableColumnResizing
        muiTableContainerProps={{ sx: { height: "100%", maxHeight: "100%" } }}
        rowVirtualizerOptions={{ overscan: 10 }}
        columnVirtualizerOptions={{ overscan: 2 }}
        defaultColumn={{ minSize: 60, maxSize: 400, size: 120 }}
        initialState={{ density: "compact" }}
        state={{ isLoading: false }}
      />
    </div>
  );
}
