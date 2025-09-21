// app/(root)/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Keep this group layout minimal so nested layouts can
  // control when to show global chrome (navbar/sidebar).
  return <>{children}</>;
}
