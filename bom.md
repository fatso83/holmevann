---
layout: page
title: Bom
exclude: true
sitemap: false
robots: noindex, nofollow
---

<style>
  .gate-page {
    max-width: 34rem;
    margin: 1.5rem auto 0;
    padding: 1.25rem;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: linear-gradient(180deg, #f8fafc, #f1f5f9);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  }

  .gate-page h1 {
    margin: 0 0 0.75rem;
    font-size: 1.25rem;
    line-height: 1.4;
  }

  .gate-opener__field {
    display: grid;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
  }

  .gate-opener__field label {
    font-weight: 600;
    color: #0f172a;
  }

  .gate-opener__field input {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 0.6rem;
    background: #fff;
    padding: 0.75rem 0.9rem;
    font-size: 1rem;
    color: #0f172a;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }

  .gate-opener__field input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .gate-opener__actions {
    display: grid;
    gap: 0.65rem;
  }

  .gate-opener__button {
    border: 0;
    border-radius: 0.65rem;
    font: inherit;
    padding: 0.72rem 1rem;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    font-weight: 600;
    color: #fff;
  }

  .gate-opener__button:active {
    transform: translateY(1px);
  }

  .gate-opener__button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .gate-opener__button--primary {
    background: linear-gradient(180deg, #2563eb, #1d4ed8);
    box-shadow: 0 10px 18px rgba(37, 99, 235, 0.22);
  }

  .gate-opener__button--ghost {
    background: #0f172a;
    color: #f8fafc;
  }

  .gate-opener__status {
    margin-top: 0.8rem;
    padding: 0.65rem 0.75rem;
    border-radius: 0.6rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    min-height: 2.5rem;
    display: grid;
    align-items: center;
  }

  .gate-opener__status[data-tone="error"] {
    border-color: #fecaca;
    color: #b91c1c;
    background: #fef2f2;
  }

  .gate-opener__status[data-tone="success"] {
    border-color: #bbf7d0;
    color: #166534;
    background: #ecfdf5;
  }
</style>

<div class="gate-page">
  <h1>Bomkontroll</h1>

  <form class="gate-opener" data-gate-unlock-form>
    <p class="gate-opener__field">
      <label for="gate-key">Nøkkel</label>
      <input
        id="gate-key"
        data-gate-password
        type="password"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        data-1p-ignore="true"
        required
      />
    </p>
    <button class="gate-opener__button gate-opener__button--primary" data-gate-unlock type="submit">
      Lås opp
    </button>
  </form>

  <div class="gate-opener__actions">
    <button class="gate-opener__button gate-opener__button--primary" data-gate-open type="button" hidden>
      Åpne bom
    </button>
    <button class="gate-opener__button gate-opener__button--ghost" data-gate-forget type="button" hidden>
      Glem hemmelighet
    </button>
  </div>

  <p class="gate-opener__status" data-gate-status hidden aria-live="polite"></p>
</div>

<script defer src="/assets/js/gate-opener.js"></script>
<script>
  window.addEventListener("DOMContentLoaded", function () {
    window.HolmevannGateOpener.initializeGateOpener({
      document: document,
      window: window,
      assetUrl: "/assets/secret.dat",
      endpoint: "https://twilio-call-experiments.carlerik.workers.dev/api/gate/open",
    });
  });
</script>
