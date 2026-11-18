import type { MidRateObservation } from "@freu-transfer/core";
import type { MidRateDto } from "./contract.ts";

/** A reference rate as the API sends it: the exact rate as a string, its source and day. */
export function toMidDto(mid: MidRateObservation): MidRateDto {
  return { rate: mid.rate.value.toString(), source: mid.source, asOf: mid.asOf };
}
