import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                width: 100%;
                min-height: 100%;
                margin: 0;
                padding: 0;
                background: #F1F5F9;
              }
              #root {
                display: flex;
                flex-direction: column;
              }
              * {
                box-sizing: border-box;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
