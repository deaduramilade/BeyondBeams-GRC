"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, Sparkles } from "lucide-react";

export type PricingPlan = {
  name: string;
  price: number;
  note: string;
  features: string[];
  popular?: boolean;
  baseMembers?: number | null;
};

export const defaultPlans: PricingPlan[] = [
  {
    name: "Free",
    price: 0,
    note: "For getting risk out of spreadsheets",
    features: ["1 workspace", "Up to 10 risks", "3 board translations"],
    baseMembers: null,
  },
  {
    name: "Growth",
    price: 39,
    note: "For small accountable teams",
    features: ["Up to 5 members", "Unlimited risks", "Compliance linkage"],
    popular: true,
    baseMembers: 5,
  },
  {
    name: "Professional",
    price: 99,
    note: "For scaling regulated teams",
    features: ["Up to 20 members", "Emerging-risk workflow", "Advanced insights"],
    baseMembers: 20,
  },
  {
    name: "Premium",
    price: 249,
    note: "For complex assurance needs",
    features: ["Up to 50 members", "Priority support", "Custom onboarding"],
    baseMembers: 50,
  },
];

export function PricingSection({ plans = defaultPlans }: { plans?: PricingPlan[] }) {
  // Store quantities for each plan (default 1, clamped between 1 and 99)
  const [quantities, setQuantities] = useState<Record<string, number>>({
    Free: 1,
    Growth: 1,
    Professional: 1,
    Premium: 1,
  });

  const updateQuantity = (planName: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[planName] ?? 1;
      const next = Math.max(1, Math.min(99, current + delta));
      return { ...prev, [planName]: next };
    });
  };

  const setExplicitQuantity = (planName: string, value: number) => {
    const valid = Math.max(1, Math.min(99, isNaN(value) ? 1 : value));
    setQuantities((prev) => ({ ...prev, [planName]: valid }));
  };

  return (
    <section id="pricing" className="landing-section py-20 lg:py-28">
      <div className="text-center">
        <p className="text-xs font-bold uppercase text-primary">Transparent pricing</p>
        <h2 className="mt-4 font-display text-4xl sm:text-5xl">Start lean. Scale when risk demands it.</h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-400">
          Monthly pricing in USD. Customise and stack plan quantities (1 to 99 units) per workspace. No hidden platform fee.
        </p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isFree = plan.price === 0;
          const qty = isFree ? 1 : (quantities[plan.name] ?? 1);
          const totalPrice = plan.price * qty;
          const totalMembers = plan.baseMembers ? plan.baseMembers * qty : null;

          return (
            <article
              key={plan.name}
              className={`relative flex flex-col justify-between border p-6 transition-all ${
                plan.popular
                  ? "border-primary bg-primary/[.07] shadow-xl shadow-black/20"
                  : "border-white/10 bg-[#071c2f]"
              }`}
            >
              {plan.popular && (
                <span className="absolute right-4 top-0 -translate-y-1/2 rounded-full bg-[#00A896] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-[#052b31] shadow-md">
                  Most popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  {qty > 1 && !isFree && (
                    <span className="inline-flex items-center gap-1 rounded bg-teal-400/15 px-2 py-0.5 text-[10px] font-bold text-teal-200">
                      <Sparkles className="size-3 text-primary" />
                      {qty}x Stacked
                    </span>
                  )}
                </div>

                <div className="mt-5">
                  <p className="flex items-baseline gap-1">
                    <span className="font-display text-4xl text-white">
                      ${totalPrice}
                    </span>
                    <span className="text-xs text-slate-400">
                      / month {qty > 1 && !isFree ? `($${plan.price}/unit)` : ""}
                    </span>
                  </p>
                </div>

                <p className="mt-3 min-h-10 text-xs leading-5 text-slate-400">{plan.note}</p>

                {/* Stacking Controller (1 to 99 units) for paid plans */}
                {!isFree ? (
                  <div className="my-5 rounded-md border border-white/10 bg-white/[.03] p-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold">Stack units (1–99):</span>
                      <span className="font-mono text-teal-300 font-bold">{qty} unit{qty > 1 ? "s" : ""}</span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${plan.name} quantity`}
                        onClick={() => updateQuantity(plan.name, -1)}
                        disabled={qty <= 1}
                        className="grid size-8 place-items-center rounded border border-white/20 bg-white/[.05] text-slate-200 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Minus className="size-3.5" />
                      </button>

                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={qty}
                        aria-label={`${plan.name} unit quantity`}
                        onChange={(e) => setExplicitQuantity(plan.name, parseInt(e.target.value, 10))}
                        className="h-8 flex-1 rounded border border-white/20 bg-black/40 text-center font-mono text-xs font-bold text-white outline-none focus:border-primary"
                      />

                      <button
                        type="button"
                        aria-label={`Increase ${plan.name} quantity`}
                        onClick={() => updateQuantity(plan.name, 1)}
                        disabled={qty >= 99}
                        className="grid size-8 place-items-center rounded border border-white/20 bg-white/[.05] text-slate-200 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    {/* Quick quantity presets */}
                    <div className="mt-2 flex justify-between gap-1 text-[10px]">
                      {[1, 3, 5, 10, 50, 99].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setExplicitQuantity(plan.name, preset)}
                          className={`rounded px-1.5 py-0.5 transition-colors ${
                            qty === preset
                              ? "bg-primary text-[#052b31] font-bold"
                              : "text-slate-400 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {preset}x
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="my-5 rounded-md border border-white/5 bg-white/[.02] p-3 text-[11px] text-slate-400">
                    Single workspace starter tier
                  </div>
                )}

                <ul className="my-6 space-y-3">
                  {plan.features.map((item, idx) => {
                    // Update member count dynamically if stacked
                    const displayItem =
                      idx === 0 && totalMembers !== null && qty > 1
                        ? `Up to ${totalMembers} members (${plan.baseMembers}/unit)`
                        : item;

                    return (
                      <li className="flex gap-2 text-xs text-slate-300" key={item}>
                        <Check className="size-3.5 shrink-0 text-primary" />
                        {displayItem}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <Link
                href={`/register?plan=${encodeURIComponent(plan.name.toLowerCase())}&qty=${qty}`}
                className={`landing-button w-full text-center ${
                  plan.popular
                    ? "bg-[#00A896] text-[#052b31] hover:bg-teal-300 shadow-md shadow-teal-950/40"
                    : "border border-white/20 text-white hover:bg-white/[.06]"
                }`}
              >
                {isFree
                  ? "Choose Free"
                  : `Choose ${plan.name} ${qty > 1 ? `(${qty}x - $${totalPrice}/mo)` : ""}`}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
