import './globals.css';

export const metadata = {
  title: 'Eric Tone Dataset Builder',
  description: 'Upload tone pairs and generate Lightroom recipe analysis.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
