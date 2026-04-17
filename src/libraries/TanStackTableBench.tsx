import { useMemo, useRef } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Row } from "../benchmark/data";
import { COLUMNS } from "../benchmark/columns";

const ROW_HEIGHT = 32;

export default function TanStackTableBench({ data }: { data: Row[] }) {
  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      COLUMNS.map((c) => ({
        accessorKey: c.key,
        header: c.header,
        size: c.width,
      })),
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const totalWidth = COLUMNS.reduce((s, c) => s + c.width, 0);

  return (
    <div
      ref={scrollRef}
      id="tanstack-scroll"
      className="tbl-scroll"
      style={{ height: "100%", overflow: "auto" }}
    >
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        <div
          className="tbl-head-row"
          style={{
            display: "flex",
            position: "sticky",
            top: 0,
            zIndex: 1,
            height: ROW_HEIGHT,
          }}
        >
          {table.getFlatHeaders().map((h) => (
            <div
              key={h.id}
              className="tbl-head-cell"
              style={{ width: h.getSize(), flex: `0 0 ${h.getSize()}px` }}
            >
              {flexRender(h.column.columnDef.header, h.getContext())}
            </div>
          ))}
        </div>
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={vi.key}
                className="tbl-row"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  transform: `translateY(${vi.start}px)`,
                  display: "flex",
                  width: "100%",
                  height: ROW_HEIGHT,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="tbl-cell"
                    style={{
                      width: cell.column.getSize(),
                      flex: `0 0 ${cell.column.getSize()}px`,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
