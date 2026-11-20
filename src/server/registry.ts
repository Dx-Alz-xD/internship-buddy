import "server-only";
import type { SourceId } from "@/lib/types";
import { CORE_ADAPTERS, type Adapter } from "./sources";
import { adzuna, careerjet, careers, himalayas, jobdata, jooble, programs } from "./sources-extra";

export const ADAPTERS: Record<SourceId, Adapter> = {
  ...CORE_ADAPTERS,
  careers,
  himalayas,
  jobdata,
  programs,
  careerjet,
  adzuna,
  jooble,
};

export const SOURCE_IDS = Object.keys(ADAPTERS) as SourceId[];
