const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const SCOPES = ["playlist-read-private", "playlist-read-collaborative"];

const clientIdInput = document.getElementById("clientId");
const playlistIdInput = document.getElementById("playlistId");
const loginBtn = document.getElementById("loginBtn");
const randomBtn = document.getElementById("randomBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

const STORAGE_KEYS = {
  clientId: "spotify_client_id",
  codeVerifier: "spotify_code_verifier",
  accessToken: "spotify_access_token",
  tokenExpiresAt: "spotify_token_expires_at"
};

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#ff8e8e" : "#a6adc8";
}

function saveClientId() {
  localStorage.setItem(STORAGE_KEYS.clientId, clientIdInput.value.trim());
}

function loadClientId() {
  const saved = localStorage.getItem(STORAGE_KEYS.clientId);
  if (saved) {
    clientIdInput.value = saved;
  }
}

function tokenIsValid() {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.tokenExpiresAt));
  return Boolean(token) && Date.now() < expiresAt;
}

function updateButtons() {
  randomBtn.disabled = !tokenIsValid();
}

function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((x) => possible[x % possible.length])
    .join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(arrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function redirectToSpotifyAuth() {
  const clientId = clientIdInput.value.trim();
  if (!clientId) {
    setStatus("Fyll i ditt Spotify Client ID först.", true);
    return;
  }

  saveClientId();
  const codeVerifier = generateRandomString(64);
  localStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SCOPES.join(" "),
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    redirect_uri: window.location.origin + window.location.pathname
  });

  window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
}

async function exchangeCodeForToken(authCode) {
  const clientId = clientIdInput.value.trim();
  const codeVerifier = localStorage.getItem(STORAGE_KEYS.codeVerifier);

  if (!clientId || !codeVerifier) {
    throw new Error("Saknar client ID eller code verifier. Logga in igen.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code: authCode,
    redirect_uri: window.location.origin + window.location.pathname,
    code_verifier: codeVerifier
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    throw new Error("Kunde inte hämta access token från Spotify.");
  }

  const data = await res.json();
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.tokenExpiresAt, String(Date.now() + data.expires_in * 1000));
  localStorage.removeItem(STORAGE_KEYS.codeVerifier);
}

async function spotifyGet(path) {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.accessToken);
      localStorage.removeItem(STORAGE_KEYS.tokenExpiresAt);
      updateButtons();
      throw new Error("Sessionen har gått ut. Logga in igen.");
    }

    throw new Error("Spotify API-fel: kontrollera att spellistan finns och är tillgänglig.");
  }

  return res.json();
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function renderTrack(track) {
  const artists = track.artists.map((a) => a.name).join(", ");
  const albumImage = track.album.images?.[0]?.url;

  resultEl.innerHTML = `
    <h2 class="track-title">${track.name}</h2>
    <p class="meta"><strong>Artist:</strong> ${artists}</p>
    <p class="meta"><strong>Album:</strong> ${track.album.name}</p>
    <p><a href="${track.external_urls.spotify}" target="_blank" rel="noopener">Öppna i Spotify</a></p>
    ${albumImage ? `<img src="${albumImage}" alt="Albumomslag" width="180" />` : ""}
  `;
}

async function getAllPlaylistTracks(playlistId) {
  let offset = 0;
  const limit = 100;
  const tracks = [];

  while (true) {
    const data = await spotifyGet(
      `/playlists/${encodeURIComponent(playlistId)}/tracks?fields=items(track(name,artists(name),album(name,images),external_urls(spotify))),next&limit=${limit}&offset=${offset}`
    );

    const validTracks = data.items.map((item) => item.track).filter(Boolean);
    tracks.push(...validTracks);

    if (!data.next) {
      break;
    }

    offset += limit;
  }

  return tracks;
}

async function showRandomTrack() {
  const playlistId = playlistIdInput.value.trim();
  if (!playlistId) {
    setStatus("Fyll i ett playlist-ID först.", true);
    return;
  }

  setStatus("Hämtar låtar...");
  resultEl.textContent = "";

  try {
    const tracks = await getAllPlaylistTracks(playlistId);
    if (!tracks.length) {
      setStatus("Spellistan verkar vara tom.", true);
      return;
    }

    const randomTrack = pickRandomItem(tracks);
    renderTrack(randomTrack);
    setStatus(`Klart! Hämtade ${tracks.length} låtar och slumpade en.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function maybeHandleAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const authCode = params.get("code");
  const authError = params.get("error");

  if (authError) {
    setStatus(`Inloggning avbröts (${authError}).`, true);
    return;
  }

  if (!authCode) {
    return;
  }

  try {
    setStatus("Loggar in...");
    await exchangeCodeForToken(authCode);
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    setStatus("Inloggad! Nu kan du slumpa en låt.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    updateButtons();
  }
}

loginBtn.addEventListener("click", redirectToSpotifyAuth);
randomBtn.addEventListener("click", showRandomTrack);

loadClientId();
updateButtons();
maybeHandleAuthRedirect();
