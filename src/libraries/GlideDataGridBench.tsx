import { forwardRef, useCallback, useMemo } from "react";
import {
  DataEditor,
  GridCellKind,
  type DataEditorRef,
  type GridCell,
  type GridColumn,
  type Item,
  type Theme,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

const DARK_THEME: Partial<Theme> = {
  accentColor: "#5b9dff",
  accentFg: "#ffffff",
  accentLight: "rgba(91, 157, 255, 0.16)",
  textDark: "#e3e7ef",
  textMedium: "#b9c0cf",
  textLight: "#8b93a7",
  textBubble: "#e3e7ef",
  bgIconHeader: "#8b93a7",
  fgIconHeader: "#e3e7ef",
  textHeader: "#b9c0cf",
  textGroupHeader: "#b9c0cf",
  textHeaderSelected: "#ffffff",
  bgCell: "#11151d",
  bgCellMedium: "#151a23",
  bgHeader: "#151a23",
  bgHeaderHasFocus: "#1c2230",
  bgHeaderHovered: "#1c2230",
  bgBubble: "#242b38",
  bgBubbleSelected: "#2e3649",
  bgSearchResult: "rgba(251, 191, 36, 0.18)",
  borderColor: "#242b38",
  horizontalBorderColor: "rgba(36, 43, 56, 0.5)",
  drilldownBorder: "#242b38",
  linkColor: "#7bb0ff",
  cellHorizontalPadding: 10,
  cellVerticalPadding: 6,
  headerFontStyle: "600 11px",
  baseFontStyle: "12px",
  fontFamily:
    "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

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
        theme={DARK_THEME}
      />
    </div>
  );
});

export default GlideDataGridBench;
