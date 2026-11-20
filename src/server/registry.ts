import "server-only";
import type { SourceId } from "@/lib/types";
import { CORE_ADAPTERS, type Adapter } from "./sources";
import { adzuna, careerjet, careers, himalayas, jobdata, jooble, programs } from "./sources-extra";
import { fantastic, freshers, hirebase, jobindex, remotejobs } from "./sources-rapid";

export const ADAPTERS: Record<SourceId, Adapter> = {
  ...CORE_ADAPTERS,
  careers,
  himalayas,
  jobdata,
  programs,
  careerjet,
  adzuna,
  jooble,
  hirebase,
  fantastic,
  jobindex,
  remotejobs,
  freshers,
};

export const SOURCE_IDS = Object.keys(ADAPTERS) as SourceId[];
