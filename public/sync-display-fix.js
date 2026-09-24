/* Moood — Display Sync Fix
   V1 — display-only: offline-first + one notification per generation + authoritative deletions.
   This file is loaded AFTER app.js. It intentionally does not modify primary-device behavior.
*/
(() => {
  "use strict";

  const DISPLAY_NOTIFY_GEN_KEY = "aboreiban_display_update_notified_generation_v1";
  const DISPLAY_LOCAL_VERSION_KEY = "aboreiban_display_local_snapshot_generation_v1";
  const DISPLAY_PATCH_VERSION = "1.0.0";

  function isDisplayDevice() {
    return !!(typeof syncRole !== "undefined" && syncRole && !syncRole.isPrimary);
  }

  function localDataExists() {
    try {
      const raw = localStorage.getItem("camp_manager_aboreiban_v4_excel");
      if (!raw) return false;
      const rows = JSON.parse(raw);
      return Array.isArray(rows);
    } catch (_) {
      return false;
    }
  }

  function readNumber(key, fallback = 0) {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : fallback;
  }

  function markGenerationStored(generation) {
    const g = Number(generation || 0);
    localStorage.setItem(DISPLAY_LOCAL_VERSION_KEY, String(g));
  }

  function notificationAlreadyShown(generation) {
    return localStorage.getItem(DISPLAY_NOTIFY_GEN_KEY) === String(Number(generation || 0));
  }

  function markNotificationShown(generation) {
    localStorage.setItem(DISPLAY_NOTIFY_GEN_KEY, String(Number(generation || 0)));
  }

  function displayUpdateToast(count, generation) {
    if (!isDisplayDevice()) return;
    if (notificationAlreadyShown(generation)) return;
    markNotificationShown(generation);
    toast(`تم تحديث جهاز العرض تلقائياً — ${Number(count || 0).toLocaleString("ar-EG")} سجل`);
  }

  /*
   * Replace the authoritative-snapshot adopter so every successful cloud
   * snapshot is also written to the normal application storage key.
   *
   * This is the critical offline fix: without this, the UI could display
   * the new snapshot in memory but a reload while offline could resurrect
   * the old localStorage data.
   */
  window.syncAdoptAuthoritativeSnapshot = async function(force = false) {
    const currentGen = readNumber("aboreiban_authoritative_generation_v51_3", 0);
    const snap = await syncFetchAuthoritativeSnapshot();

    if (!force && snap.generation <= currentGen) {
      return {
        changed: false,
        generation: snap.generation,
        count: Array.isArray(data) ? data.length : 0
      };
    }

    const next = (snap.records || []).map((x, i) => {
      const r = structuredClone(x.data || {});
      r.__syncId = x.recordId;
      r.__syncVersion = Number(x.version || 0);
      r["#"] = String(i + 1);
      return r;
    });

    data = next;
    renumber();

    // Save BOTH the sync shadow and the actual application data.
    syncSaveShadow(data);
    syncSavePending([]);
    localStorage.setItem("camp_manager_aboreiban_v4_excel", JSON.stringify(data));

    localStorage.setItem("aboreiban_authoritative_generation_v51_3", String(Number(snap.generation || 0)));
    markGenerationStored(snap.generation);

    if (typeof __syncHealthCache !== "undefined" && __syncHealthCache) {
      localStorage.setItem(
        "aboreiban_sync_cursor_v1",
        String(Number(__syncHealthCache.latestSeq || 0))
      );
      syncCursor = Number(__syncHealthCache.latestSeq || 0);
    }

    rebuildFilters();
    renderAll();

    return {
      changed: true,
      generation: Number(snap.generation || 0),
      count: data.length
    };
  };

  /*
   * Display-device reconcile:
   * - Never requires internet to keep showing local data.
   * - Only downloads when online and a newer generation exists.
   * - Uses the authoritative snapshot, so deletions are mirrored too.
   * - Shows one notification per generation, not once per polling cycle
   *   and not once per page reload.
   */
  window.syncOnlineReconcile = async function(reason = "auto") {
    if (syncBusy || !navigator.onLine) return;
    syncBusy = true;

    try {
      await fetchSyncRole(true);

      if (syncRole.isPrimary) {
        /*
         * Do not alter the primary-device path. Reproduce the existing
         * primary behavior through the original helpers.
         */
        if (!syncRole.configured) {
          return;
        }

        const rec = await syncPrimaryReconcileOnce();
        if (rec?.ok && !rec?.skipped) {
          toast("تم اعتماد بيانات الجهاز الرئيسي — أصبحت هذه النسخة المرجع الرسمي");
        }

        syncLoadShadow();
        syncRebuildPending();

        const pushed = await syncPush();

        if (pushed.total > 0 && pushed.accepted === pushed.total) {
          const h = await syncFetch("/health", { method: "GET" });
          __syncHealthCache = h;
          __syncHealthAt = Date.now();

          syncSaveShadow(data);
          syncSavePending([]);

          localStorage.setItem(
            "aboreiban_authoritative_generation_v51_3",
            String(Number(h.authoritativeGeneration || localStorage.getItem("aboreiban_authoritative_generation_v51_3") || 0))
          );
        }

        syncInitialized = true;
        return;
      }

      // DISPLAY DEVICE
      if (!syncRole.authoritativeReady) {
        syncSavePending([]);
        syncInitialized = true;
        return;
      }

      const seen = readNumber("aboreiban_authoritative_generation_v51_3", 0);
      const serverGen = Number(syncRole.authoritativeGeneration || 0);

      /*
       * First run:
       * If localStorage already contains a snapshot at this generation,
       * simply keep using it. This prevents a notification after every
       * reload/restart.
       *
       * If there is no local data, fetch the authoritative snapshot once.
       */
      const hasLocal = localDataExists();

      if (!hasLocal || serverGen > seen) {
        const h = await syncFetch("/health", { method: "GET" });
        __syncHealthCache = h;
        __syncHealthAt = Date.now();

        const snap = await window.syncAdoptAuthoritativeSnapshot(true);

        if (snap.changed) {
          displayUpdateToast(snap.count, snap.generation);
        }
      } else if (serverGen < seen) {
        /*
         * The local snapshot is newer than the role response (for example
         * immediately after a reconnect). Do not erase local data.
         * A later health check will reconcile the generation.
         */
      }

      syncSavePending([]);
      syncInitialized = true;
    } catch (e) {
      console.warn("Moood display sync fix:", e);

      /*
       * Offline is a normal operating mode for display devices.
       * Do not show an error toast on automatic/timer/online checks.
       */
      if (reason === "manual") {
        toast(`تعذر تحديث السحابة: ${e?.message || "البيانات المحلية محفوظة"}`);
        throw e;
      }
    } finally {
      syncBusy = false;
    }
  };

  /*
   * If app.js has already installed its timer, the timer will call the
   * global function above on its next tick. We also trigger one clean
   * display reconciliation after this patch has loaded.
   */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => {
        if (isDisplayDevice()) window.syncOnlineReconcile("startup");
      }, 50);
    }, { once: true });
  } else {
    setTimeout(() => {
      if (isDisplayDevice()) window.syncOnlineReconcile("startup");
    }, 50);
  }

  window.__MOOD_DISPLAY_SYNC_FIX_VERSION = DISPLAY_PATCH_VERSION;
})();
