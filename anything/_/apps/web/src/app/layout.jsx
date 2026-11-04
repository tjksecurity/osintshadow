import ClientProviders from "./ClientProviders";
import ClientOnly from "./ClientOnly"; // add client-only guard to prevent SSR/client mismatches
import "@/components/Theme/product.css";

export default function RootLayout({ children }) {
  // Remove html/head/body tags to avoid nesting under the platform's root <html> in root.tsx
  // Keep a stable, simple wrapper so SSR and client markup match
  return (
    <div className="st-product" style={{ minHeight: "100vh", margin: 0 }}>
      {/* All client-only providers live in a dedicated client wrapper */}
      <ClientOnly
        fallback={
          <div className="st-route-loading" />
        }
      >
        <ClientProviders>
          <div className="st-route-loading">
            {children}
          </div>
        </ClientProviders>
      </ClientOnly>
    </div>
  );
}
