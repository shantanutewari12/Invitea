"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { share } from "@/copy/en";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** QR for one link, generated entirely in the browser (the link never goes to a QR service). */
export function QrButton({ url, name }: { url: string; name: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  async function toggle() {
    if (svg) return setSvg(null);
    const QRCode = (await import("qrcode")).default;
    setSvg(await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }));
  }

  async function downloadPng() {
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(url, { width: 768, margin: 2, errorCorrectionLevel: "M" });
    download(await (await fetch(dataUrl)).blob(), `${name}.png`);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void toggle()} aria-expanded={svg !== null}>
        {share.qr}
      </Button>
      {svg && (
        <div className="flex flex-col items-start gap-2" data-testid="qr-panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimise */}
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={`QR code for ${name}`} width={192} height={192} className="rounded-lg border border-border bg-white" />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => download(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`)}>
              {share.qrSvg}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void downloadPng()}>
              {share.qrPng}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
