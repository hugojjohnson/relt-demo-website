declare module "xlsx-populate/browser/xlsx-populate" {
  type OutputOptions = { type: "blob"; password?: string };
  type Workbook = { outputAsync(options: OutputOptions): Promise<Blob> };
  const XlsxPopulate: { fromDataAsync(data: ArrayBuffer | Uint8Array): Promise<Workbook> };
  export default XlsxPopulate;
}
