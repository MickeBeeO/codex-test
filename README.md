# Spotify Random Song

En enkel webbapp som loggar in med Spotify och hämtar en helt slumpmässig låt från en vald spellista.

## Funktioner

- Logga in med Spotify (Authorization Code + PKCE)
- Hämta alla låtar i en spellista
- Visa en slumpmässig låt med artist, album och länk till Spotify

## Kom igång

1. Skapa en app i [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Kopiera ditt **Client ID**.
3. Lägg till en **Redirect URI** i Spotify-appen, t.ex.:
   - `http://127.0.0.1:5500`
   - `http://localhost:5500`
4. Starta en enkel lokal server i projektmappen:

   ```bash
   python3 -m http.server 5500 --bind 127.0.0.1
   ```

5. Öppna `http://127.0.0.1:5500` i webbläsaren.
6. Fyll i Client ID och Playlist-ID och klicka på knapparna i appen.

## Hitta playlist-ID

Från en Spotify URL som:

`https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`

är playlist-ID:

`37i9dQZF1DXcBWIGoYBM5M`
