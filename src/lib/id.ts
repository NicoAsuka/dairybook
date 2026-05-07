import { monotonicFactory } from "ulidx";

const ulid = monotonicFactory();

export function newId(): string {
  return ulid();
}
