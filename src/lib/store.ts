"use client";

import { del, get, set } from "idb-keyval";
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Application, AppStatus, Listing, Profile } from "./types";

/** Everything the student enters stays in this browser's IndexedDB. */
const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
};

const CV_KEY = "internship-buddy:cv-file";
export const saveCvFile = (file: Blob) => set(CV_KEY, file);
export const loadCvFile = () => get<Blob>(CV_KEY);
export const removeCvFile = () => del(CV_KEY);

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

type NewApplication = Partial<Application> & Pick<Application, "title" | "company">;

type State = {
  profile: Profile | null;
  applications: Application[];
  hidden: string[];
  activeRole: string | null;
  setProfile: (p: Profile) => void;
  patchProfile: (p: Partial<Profile>) => void;
  setActiveRole: (id: string) => void;
  addApplication: (a: NewApplication) => Application;
  trackListing: (l: Listing, status: AppStatus) => Application;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  moveApplication: (id: string, status: AppStatus) => void;
  removeApplication: (id: string) => void;
  hideListing: (id: string) => void;
  unhideAll: () => void;
  importData: (data: { profile: Profile | null; applications: Application[] }) => void;
  reset: () => void;
};

export const useAppStore = create<State>()(
  persist(
    (setState, getState) => ({
      profile: null,
      applications: [],
      hidden: [],
      activeRole: null,

      setProfile: (profile) => setState({ profile: { ...profile, updatedAt: now() } }),
      patchProfile: (patch) => {
        const p = getState().profile;
        if (p) setState({ profile: { ...p, ...patch, updatedAt: now() } });
      },
      setActiveRole: (activeRole) => setState({ activeRole }),

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
      hideListing: (id) => setState((s) => ({ hidden: Array.from(new Set([...s.hidden, id])) })),
      unhideAll: () => setState({ hidden: [] }),
      importData: ({ profile, applications }) => setState({ profile, applications, activeRole: null }),
      reset: () => setState({ profile: null, applications: [], hidden: [], activeRole: null }),
    }),
    {
      name: "internship-buddy",
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      skipHydration: true,
      partialize: (s) => ({ profile: s.profile, applications: s.applications, hidden: s.hidden, activeRole: s.activeRole }),
    },
  ),
);

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
