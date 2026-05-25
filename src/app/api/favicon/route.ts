import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ faviconUrl: null }, { status: 400 });

  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return NextResponse.json({ faviconUrl: null }, { status: 400 });
  }

  const results: string[] = [];

  try {
    const res = await fetch(base.toString(), {
      headers: { 'User-Agent': 'mila-hmi/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    // Extract favicon from <link> tags
    const linkRe = /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi;
    const hrefRe = /href=["']([^"']+)["']/i;
    for (const match of html.matchAll(linkRe)) {
      const href = hrefRe.exec(match[0])?.[1];
      if (href) {
        try {
          results.push(new URL(href, base).toString());
        } catch {
          // invalid href, skip
        }
      }
    }
  } catch {
    // fetch failed, fall through to fallback
  }

  // Fallback: /favicon.ico
  if (results.length === 0) {
    results.push(new URL('/favicon.ico', base).toString());
  }

  return NextResponse.json({ faviconUrl: results[0] });
}
