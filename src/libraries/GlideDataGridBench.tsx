import { forwardRef, useCallback, useMemo } from "react";
import {
  DataEditor,
  GridCellKind,
  type DataEditorRef,
  type GridCell,
  type GridColumn,
  type Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

const GlideDataGridBench = forwardRef<DataEditorRef, { data: Row[] }>(function GlideDataGridBench(
  { data },
  ref,
) {
  const columns = useMemo<GridColumn[]>(
    () => COLUMNS.map((c) => ({ title: c.header, id: c.key as string, width: c.width })),
    [],
  );

  const getCellContent = useCallback(
    ([col, rowIdx]: Item): GridCell => {
      const spec = COLUMNS[col];
      const row = data[rowIdx];
      if (!row) {
        return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
      }
      const val = row[spec.key];
      if (spec.type === "number") {
        return {
          kind: GridCellKind.Number,
          data: val as number,
          displayData: String(val),
          allowOverlay: false,
        };
      }
      if (spec.type === "boolean") {
        return {
          kind: GridCellKind.Boolean,
          data: val as boolean,
          allowOverlay: false,
        };
      }
      return {
        kind: GridCellKind.Text,
        data: String(val),
        displayData: String(val),
        allowOverlay: false,
      };
    },
    [data],
  );

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <DataEditor
        ref={ref}
        columns={columns}
        rows={data.length}
        getCellContent={getCellContent}
        rowHeight={32}
        headerHeight={34}
        smoothScrollX
        smoothScrollY
        width="100%"
        height="100%"
      />
    </div>
  );
});

export default GlideDataGridBench;
