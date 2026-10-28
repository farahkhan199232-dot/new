"use client";

import { useEffect, useRef, useState } from "react";

/* Minimal typing for the PayPal JS SDK we use. */
declare global {
  interface Window {
    paypal?: {
      Buttons: (o: {
        style?: Record<string, unknown>;
        createOrder: () => Promise<string>;
        onApprove: (d: { orderID: string }) => Promise<void>;
        onError?: (e: unknown) => void;
        onCancel?: () => void;
      }) => { render: (el: HTMLElement) => Promise<void>; close?: () => Promise<void> };
    };
  }
}

let sdkPromise: Promise<void> | null = null;
function loadSdk(clientId: string, currency: string) {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons&disable-funding=paylater`;
    s.onload = () => resolve();
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("Could not load PayPal"));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

interface Props {
  clientId: string;
  currency: string;
  amount: string;
  createOrder: () => Promise<string>;
  capture: (orderId: string) => Promise<void>;
}

/**
 * PayPal Smart Payment Buttons. Order creation and capture both happen on our
 * server (Orders API v2); the browser only shows PayPal's approval flow.
 */
export function PayPalFund({ clientId, currency, amount, createOrder, capture }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useRef({ createOrder, capture });
  handlers.current = { createOrder, capture };
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let buttons: { close?: () => Promise<void> } | null = null;
    // One retry: the SDK script occasionally fails on a cold first load.
    loadSdk(clientId, currency)
      .catch(() => new Promise<void>((r) => setTimeout(r, 1500)).then(() => loadSdk(clientId, currency)))
      .then(() => {
        if (cancelled || !ref.current || !window.paypal) return;
        ref.current.innerHTML = "";
        const b = window.paypal.Buttons({
          style: { layout: "vertical", shape: "pill", color: "gold", label: "paypal", height: 45 },
          createOrder: () => handlers.current.createOrder(),
          onApprove: async (d) => {
            setMsg("Capturing payment…");
            try {
              await handlers.current.capture(d.orderID);
              setMsg("");
            } catch (e) {
              setMsg((e as Error).message);
            }
          },
          onCancel: () => setMsg("Payment cancelled."),
          onError: (e) => setMsg(e instanceof Error ? e.message : "PayPal could not complete the payment."),
        });
        buttons = b;
        return b.render(ref.current).then(() => !cancelled && setState("ready"));
      })
      .catch((e) => {
        if (cancelled) return;
        setState("error");
        setMsg((e as Error).message);
      });
    return () => {
      cancelled = true;
      buttons?.close?.().catch(() => {});
    };
  }, [clientId, currency]);

  return (
    <div>
      {state === "loading" && <p className="muted">Loading PayPal…</p>}
      <div ref={ref} aria-label={`Pay ${amount} ${currency} with PayPal`} />
      {msg && <p className="muted" style={{ marginTop: 6 }}>{msg}</p>}
    </div>
  );
}
