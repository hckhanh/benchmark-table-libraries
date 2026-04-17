import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AGGridBench({ data }: { data: Row[] }) {
  const columnDefs = useMemo<ColDef<Row>[]>(
    () =>
      COLUMNS.map(
        (c): ColDef<Row> => ({
          field: c.key,
          headerName: c.header,
          width: c.width,
          sortable: true,
          filter: true,
          resizable: true,
        }),
      ),
    [],
  );
  const defaultColDef = useMemo<ColDef>(() => ({ suppressMovable: true }), []);

  return (
    <div className="ag-theme-alpine ag-grid-wrapper" style={{ height: "100%", width: "100%" }}>
      <AgGridReact<Row>
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowBuffer={20}
        rowHeight={32}
        headerHeight={34}
        animateRows={false}
        suppressColumnVirtualisation={false}
        getRowId={(p) => String(p.data.id)}
      />
    </div>
  );
}
