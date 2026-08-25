"use client";

import Script from "next/script";

export function TurnstileWidget({ siteKey, action }: { siteKey: string; action: string }) {
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive"/>
    <div className="cf-turnstile min-h-[65px]" data-sitekey={siteKey} data-action={action} data-theme="dark" data-response-field-name="turnstileToken"/>
  </>;
}