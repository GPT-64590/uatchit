import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "uatchit — right-click any web page. watch it forever.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="url(#g)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7cb0ff"/><stop offset="1" stop-color="#4e7cef"/></linearGradient></defs><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1" fill="#4e7cef" stroke="none"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/></svg>`;
const markUri = `data:image/svg+xml;utf8,${encodeURIComponent(markSvg)}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(180deg, #07070a 0%, #0a0a0d 100%)",
          color: "#f3f3f6",
          fontFamily: "system-ui",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#6ea8ff",
            marginBottom: 32,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img width={44} height={44} src={markUri} alt="" />
          <span style={{ fontSize: 24, fontWeight: 500, color: "#f3f3f6" }}>uatchit</span>
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span
            style={{
              background: "linear-gradient(180deg, #fff 0%, #b9bac4 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            right-click any web page.
          </span>
          <span
            style={{
              background: "linear-gradient(180deg, #8ab8ff 0%, #4e7cef 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            watch it forever.
          </span>
        </div>
        <div style={{ fontSize: 22, color: "rgba(243,243,246,0.62)", marginTop: 40 }}>
          uatchit.com
        </div>
      </div>
    ),
    size
  );
}
