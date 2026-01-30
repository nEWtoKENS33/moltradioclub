import "@/styles/globals.css";

export const metadata = {
  title: "Molt Radio Club",
  description: "Welcome to the best podcast",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
