export function Status({ value }: { value: string }) {
  return <i className={"status " + value.toLowerCase()}>{value.replaceAll("_", " ")}</i>;
}
