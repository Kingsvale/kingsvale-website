import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { createTrackingSite } from "../lib/trackingStorage";
import { saveTrackingSiteWithResult } from "../lib/cmsApi";
import { flushWorkflowEdits } from "../lib/workflowNavigation";
import { siteFingerprint, useSiteAutosave } from "./useSiteAutosave";
vi.mock("../lib/cmsApi", () => ({ saveTrackingSiteWithResult: vi.fn() }));
const save = vi.mocked(saveTrackingSiteWithResult);

function setup() {
  return renderHook(() => {
    const [draft, setDraft] = useState(createTrackingSite);
    const [saved, setSaved] = useState(draft);
    const [valid, setValid] = useState(true);
    const [blocked, setBlocked] = useState(false);
    const autosave = useSiteAutosave({ draft, saved, valid, blocked, onSaved: (next, snapshot) => {
      setSaved(next);
      setDraft((current) => siteFingerprint(current) === siteFingerprint(snapshot) ? next : { ...current, updatedAt: next.updatedAt });
    } });
    return { ...autosave, draft, saved, setDraft, setValid, setBlocked };
  });
}
beforeEach(() => { vi.useFakeTimers(); save.mockReset(); save.mockImplementation(async (site) => ({ site: { ...site, updatedAt: new Date().toISOString() }, googleSheetSync: null })); });
afterEach(() => { vi.useRealTimers(); });

it("debounces typing and saves the latest complete draft once", async () => {
  const { result } = setup();
  act(() => result.current.setDraft((site) => ({ ...site, title: "New" })));
  await act(() => vi.advanceTimersByTimeAsync(700));
  act(() => result.current.setDraft((site) => ({ ...site, title: "New site name" })));
  await act(() => vi.advanceTimersByTimeAsync(999));
  expect(save).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(save).toHaveBeenCalledTimes(1);
  expect(result.current.saved.title).toBe("New site name");
  expect(result.current.dirty).toBe(false);
});

it("preserves typing during a slow save and serializes the subsequent save", async () => {
  let finish!: () => void;
  save.mockImplementationOnce((site) => new Promise((resolve) => { finish = () => resolve({ site: { ...site, updatedAt: "later" }, googleSheetSync: null }); }));
  const { result } = setup();
  act(() => result.current.setDraft((site) => ({ ...site, title: "First edit" })));
  await act(() => vi.advanceTimersByTimeAsync(1000));
  act(() => result.current.setDraft((site) => ({ ...site, title: "More typing while saving" })));
  await act(() => vi.advanceTimersByTimeAsync(1200));
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  expect(save).toHaveBeenCalledTimes(2);
  expect(result.current.draft.title).toBe("More typing while saving");
  expect(result.current.saved.title).toBe("More typing while saving");
});

it("flushes immediately before navigation and blocks navigation on invalid edits", async () => {
  const { result } = setup();
  act(() => result.current.setDraft((site) => ({ ...site, customerName: "New owner" })));
  let canLeave = false;
  await act(async () => { canLeave = await flushWorkflowEdits(); });
  expect(canLeave).toBe(true);
  expect(result.current.saved.customerName).toBe("New owner");
  act(() => { result.current.setDraft((site) => ({ ...site, title: "" })); result.current.setValid(false); });
  await act(async () => { canLeave = await flushWorkflowEdits(); });
  expect(canLeave).toBe(false);
  expect(result.current.draft.title).toBe("");
  expect(result.current.error).toContain("highlighted");
});

it("keeps failed edits and supports explicit retry without falsely claiming a save", async () => {
  save.mockRejectedValueOnce(new Error("offline"));
  const { result } = setup();
  act(() => result.current.setDraft((site) => ({ ...site, mailingNotes: "Keep this note" })));
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(result.current.dirty).toBe(true);
  expect(result.current.label).toContain("Could not save");
  expect(result.current.saved.mailingNotes).not.toBe("Keep this note");
  await act(async () => { await result.current.flush(); });
  expect(result.current.saved.mailingNotes).toBe("Keep this note");
  expect(result.current.dirty).toBe(false);
});

it("pauses autosave and navigation during uploads or generation", async () => {
  const { result } = setup();
  act(() => { result.current.setBlocked(true); result.current.setDraft((site) => ({ ...site, title: "Uploading" })); });
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(save).not.toHaveBeenCalled();
  let canLeave = true;
  await act(async () => { canLeave = await flushWorkflowEdits(); });
  expect(canLeave).toBe(false);
  act(() => result.current.setBlocked(false));
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(result.current.saved.title).toBe("Uploading");
});
