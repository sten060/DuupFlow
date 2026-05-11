declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer | Uint8Array | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };
  function heicConvert(opts: ConvertOptions): Promise<Uint8Array>;
  export default heicConvert;
}
