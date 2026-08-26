import { NextResponse } from "next/server";

// Read the env var per request rather than at build time.
export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, must-revalidate",
} as const;

function parseDestination(raw: string | undefined): URL | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  return url;
}

const comingSoonPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Video coming soon | LUCID</title>
    <style>
      :root {
        color-scheme: light dark;
        --primary: rgb(25, 39, 108);
        --background: rgb(248, 249, 252);
        --on-background: rgb(28, 27, 31);
        --on-surface-variant: rgb(100, 100, 105);
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --background: rgb(15, 24, 74);
          --on-background: rgb(255, 255, 255);
          --on-surface-variant: rgba(255, 255, 255, 0.7);
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 2rem 1.5rem;
        text-align: center;
        background: var(--background);
        color: var(--on-background);
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      .bar {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 6px;
        background: var(--primary);
      }
      h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
      p { margin: 0; color: var(--on-surface-variant); }
      a { color: inherit; margin-top: 1rem; }
    </style>
  </head>
  <body>
    <div class="bar"></div>
    <h1>Video coming soon</h1>
    <p>The LUCID demo video isn't published yet. Check back shortly.</p>
    <a href="/">Go to LUCID</a>
  </body>
</html>
`;

export async function GET() {
  const destination = parseDestination(process.env.DEMO_VIDEO_URL);

  if (!destination) {
    return new NextResponse(comingSoonPage, {
      status: 200,
      headers: {
        ...NO_STORE,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return new NextResponse(null, {
    status: 307,
    headers: {
      ...NO_STORE,
      Location: destination.toString(),
    },
  });
}
