import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    className?: string // apply to both th and td
    tdClassName?: string
    thClassName?: string
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
