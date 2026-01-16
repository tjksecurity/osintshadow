import ClientProviders from "./ClientProviders";
import ClientOnly from "./ClientOnly"; // add client-only guard to prevent SSR/client mismatches

export default function RootLayout({ children }) {
  // Remove html/head/body tags to avoid nesting under the platform's root <html> in root.tsx
  // Keep a stable, simple wrapper so SSR and client markup match
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#263043", margin: 0 }}>
      {/* All client-only providers live in a dedicated client wrapper */}
      <ClientOnly
        fallback={
          <div style={{ minHeight: "100vh", backgroundColor: "#263043" }} />
        }
      >
        <ClientProviders>
          <div style={{ minHeight: "100vh", backgroundColor: "#263043" }}>
            {children}
          </div>
        </ClientProviders>
      </ClientOnly>
    </div>
  );
}
