// app/api/stripe/portal-return/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Verify user is still authenticated
    const { userId } = await auth();
    
    if (!userId) {
      // If not authenticated, redirect to sign-in
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    
    // Force a hard reload to the settings page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url.split('/api')[0];
    const redirectUrl = `${baseUrl}/`;
    
    // Return HTML that forces a complete page reload
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Returning to Settings...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #000;
              color: #fff;
            }
            .loader {
              text-align: center;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 3px solid rgba(255,255,255,0.3);
              border-top-color: #fff;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 0 auto 20px;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="loader">
            <div class="spinner"></div>
            <div>Returning to settings...</div>
          </div>
          <script>
            // Clear any stale state and force reload
            window.history.replaceState({}, '', '${redirectUrl}');
            window.location.replace('${redirectUrl}');
          </script>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error("[PORTAL_RETURN]", error);
    // Fallback to home on error
    return NextResponse.redirect(new URL('/', req.url));
  }
}