"use client";

import { del, get, set } from "idb-keyval";
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Application, AppStatus, CompanyPrep, CvVersion, Listing, Profile } from "./types";

/** Everything the student enters stays in this browser's IndexedDB. */
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
};

const LEGACY_CV_KEY = "internship-buddy:cv-file";
const cvKey = (id: string) => `internship-buddy:cv:${id}`;
export const saveCvFile = (id: string, file: Blob) => set(cvKey(id), file);
export const loadCvFile = async (id: string) => (await get<Blob>(cvKey(id))) ?? (id === "legacy" ? get<Blob>(LEGACY_CV_KEY) : undefined);
export const removeCvFile = async (id: string) => {
  await del(cvKey(id));
  if (id === "legacy") await del(LEGACY_CV_KEY);
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
export const companyKey = (name: string) => name.toLowerCase().replace(/\b(pvt|private|ltd|limited|llp|inc)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

type NewApplication = Partial<Application> & Pick<Application, "title" | "company">;

/** A saved AI answer, keyed by task and the listing/CV it was about. */
export type AiEntry = { at: string; data: unknown };
const AI_CACHE_LIMIT = 200;

type State = {
  profile: Profile | null;
  applications: Application[];
  cvs: CvVersion[];
  prep: Record<string, CompanyPrep>;
  ai: Record<string, AiEntry>;
  aiConsent: boolean;
  notify: { enabled: boolean; sent: Record<string, string> };
  hidden: string[];
  activeRole: string | null;

  setProfile: (p: Profile) => void;
  patchProfile: (p: Partial<Profile>) => void;
  setActiveRole: (id: string) => void;

  addCv: (cv: CvVersion) => void;
  updateCv: (id: string, patch: Partial<CvVersion>) => void;
  removeCv: (id: string) => void;

  addApplication: (a: NewApplication) => Application;
  trackListing: (l: Listing, status: AppStatus) => Application;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  moveApplication: (id: string, status: AppStatus) => void;
  removeApplication: (id: string) => void;

  savePrep: (company: string, patch: Partial<CompanyPrep>) => void;
  saveAi: (key: string, data: unknown) => void;
  setAiConsent: (v: boolean) => void;
  setNotify: (patch: Partial<State["notify"]>) => void;

  hideListing: (id: string) => void;
  unhideAll: () => void;
  importData: (data: Partial<Pick<State, "profile" | "applications" | "cvs" | "prep">>) => void;
  reset: () => void;
};

const EMPTY = {
  profile: null,
  applications: [],
  cvs: [],
  prep: {},
  ai: {},
  aiConsent: false,
  notify: { enabled: false, sent: {} },
  hidden: [],
  activeRole: null,
};

export const useAppStore = create<State>()(
  persist(
    (setState, getState) => ({
      ...EMPTY,

      setProfile: (profile) => setState({ profile: { ...profile, updatedAt: now() } }),
      patchProfile: (patch) => {
        const p = getState().profile;
        if (p) setState({ profile: { ...p, ...patch, updatedAt: now() } });
      },
      setActiveRole: (activeRole) => setState({ activeRole }),

      addCv: (cv) => setState((s) => ({ cvs: [...s.cvs.filter((c) => c.id !== cv.id), cv] })),
      updateCv: (id, patch) => setState((s) => ({ cvs: s.cvs.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCv: (id) =>
        setState((s) => {
          const cvs = s.cvs.filter((c) => c.id !== id);
          const profile = s.profile && s.profile.cvId === id ? { ...s.profile, cvId: cvs[0]?.id ?? null } : s.profile;
          return { cvs, profile };
        }),

      addApplication: (a) => {
        const status = a.status ?? "saved";
        const app: Application = {
          id: uid(),
          listingId: null,
          source: "manual",
          logo: null,
          url: "",
          locationLabel: "",
          payLabel: null,
          notes: "",
          appliedOn: status !== "saved" ? today() : null,
          deadline: null,
          nextStepOn: null,
          nextStep: "",
          contact: "",
          cvId: getState().profile?.cvId ?? null,
          createdAt: now(),
          updatedAt: now(),
          ...a,
          status,
          history: [{ status, at: now() }],
        };
        setState((s) => ({ applications: [app, ...s.applications] }));
        return app;
      },

      trackListing: (l, status) => {
        const existing = getState().applications.find((a) => a.listingId === l.id);
        if (existing) {
          getState().moveApplication(existing.id, status);
          return { ...existing, status };
        }
        return getState().addApplication({
          listingId: l.id,
          source: l.source,
          title: l.title,
          company: l.company,
          logo: l.logo,
          url: l.url,
          locationLabel: l.locationLabel,
          payLabel: l.pay?.label || null,
          deadline: l.deadline ? l.deadline.slice(0, 10) : null,
          status,
        });
      },

      updateApplication: (id, patch) =>
        setState((s) => ({
          applications: s.applications.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: now() } : a)),
        })),

      moveApplication: (id, status) =>
        setState((s) => ({
          applications: s.applications.map((a) => {
            if (a.id !== id || a.status === status) return a;
            return {
              ...a,
              status,
              appliedOn: a.appliedOn ?? (status !== "saved" ? today() : null),
              history: [...a.history, { status, at: now() }],
              updatedAt: now(),
            };
          }),
        })),

      removeApplication: (id) => setState((s) => ({ applications: s.applications.filter((a) => a.id !== id) })),

      savePrep: (company, patch) =>
        setState((s) => {
          const key = companyKey(company);
          const prev = s.prep[key] ?? { company, notes: "", questions: [], updatedAt: now() };
          return { prep: { ...s.prep, [key]: { ...prev, ...patch, updatedAt: now() } } };
        }),

      saveAi: (key, data) =>
        setState((s) => {
          const entries = Object.entries({ ...s.ai, [key]: { at: now(), data } });
          // Keep the newest results only, so the cache never grows without bound.
          entries.sort((a, b) => b[1].at.localeCompare(a[1].at));
          return { ai: Object.fromEntries(entries.slice(0, AI_CACHE_LIMIT)) };
        }),
      setAiConsent: (aiConsent) => setState({ aiConsent }),
      setNotify: (patch) => setState((s) => ({ notify: { ...s.notify, ...patch } })),

      hideListing: (id) => setState((s) => ({ hidden: Array.from(new Set([...s.hidden, id])) })),
      unhideAll: () => setState({ hidden: [] }),
      importData: (data) =>
        setState((s) => ({
          profile: data.profile ?? s.profile,
          applications: data.applications ?? s.applications,
          cvs: data.cvs ?? s.cvs,
          prep: data.prep ?? s.prep,
          activeRole: null,
        })),
      reset: () => setState({ ...EMPTY }),
    }),
    {
      name: "internship-buddy",
      version: 2,
      storage: createJSONStorage(() => idbStorage),
      skipHydration: true,
      partialize: (s) => ({
        profile: s.profile,
        applications: s.applications,
        cvs: s.cvs,
        prep: s.prep,
        ai: s.ai,
        aiConsent: s.aiConsent,
        notify: s.notify,
        hidden: s.hidden,
        activeRole: s.activeRole,
      }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          // v1 kept a single CV on the profile; v2 keeps a list of versions.
          const profile = state.profile as (Profile & { cv?: { name: string; size: number; type: string; uploadedAt: string; skills: string[]; wordCount: number; preview: string } | null }) | null;
          const cvs: CvVersion[] = [];
          if (profile?.cv) {
            cvs.push({
              id: "legacy",
              label: "Main CV",
              name: profile.cv.name,
              size: profile.cv.size,
              type: profile.cv.type,
              uploadedAt: profile.cv.uploadedAt,
              text: profile.cv.preview,
              skills: profile.cv.skills,
              wordCount: profile.cv.wordCount,
            });
          }
          if (profile) {
            const { cv: _legacy, ...rest } = profile;
            void _legacy;
            state.profile = { ...rest, cvId: cvs[0]?.id ?? null };
          }
          Object.assign(state, { cvs, prep: {}, ai: {}, aiConsent: false, notify: { enabled: false, sent: {} } });
        }
        return state as unknown as State;
      },
    },
  ),
);

export const primaryCv = (s: Pick<State, "cvs" | "profile">) =>
  s.cvs.find((c) => c.id === s.profile?.cvId) ?? s.cvs[0] ?? null;

let rehydrateStarted = false;
const subscribeHydration = (cb: () => void) => useAppStore.persist.onFinishHydration(cb);
const isHydrated = () => useAppStore.persist.hasHydrated();
const notHydratedOnServer = () => false;

/** True once saved data has been loaded from IndexedDB. Render placeholders until then. */
export function useHydrated() {
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, notHydratedOnServer);
  useEffect(() => {
    if (!rehydrateStarted && !useAppStore.persist.hasHydrated()) {
      rehydrateStarted = true;
      void useAppStore.persist.rehydrate();
    }
  }, []);
  return hydrated;
}
