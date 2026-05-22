// Allow overriding the API base when the frontend is hosted separately from the backend.
// Set `window.__API_BASE` in the page (e.g. in admin.html) to the full backend API base URL
// like `https://your-backend.example.com/api/admin`.
const API_BASE = (() => {
  if (typeof window !== "undefined" && window.__API_BASE) {
    return window.__API_BASE;
  }
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return `${window.location.origin}/api/admin`;
  }
  return typeof window !== "undefined" ? `${window.location.origin}/api/admin` : "http://127.0.0.1:3000/api/admin";
})();
const TOKEN_KEY = "movie_admin_token";

const state = {
  selectedTitle: null,
  selectedFiles: [],
  selectedFile: null,
  imdbData: null,
  titlePage: 1,
  titleTotalPages: 1,
  titleSearch: "",
  isLoadingTitles: false,
  displayFileCount: 10,
  titles: [],
  selectedMovieIds: new Set(),
  selectedFileIds: new Set(),
};

const elements = {
  loginScreen: document.getElementById("login-screen"),
  adminScreen: document.getElementById("admin-screen"),
  loginForm: document.getElementById("loginForm"),
  adminPassword: document.getElementById("adminPassword"),
  loginError: document.getElementById("loginError"),
  fileSearch: document.getElementById("fileSearch"),
  fileSearchBtn: document.getElementById("fileSearchBtn"),
  selectAllMoviesBtn: document.getElementById("selectAllMoviesBtn"),
  deleteSelectedMoviesBtn: document.getElementById("deleteSelectedMoviesBtn"),
  clearMovieSelectionBtn: document.getElementById("clearMovieSelectionBtn"),
  titlesWrapper: document.getElementById("titlesWrapper"),
  titlesList: document.getElementById("titlesList"),
  titlesEmpty: document.getElementById("titlesEmpty"),
  titlesLoading: document.getElementById("titlesLoading"),
  selectedMovieCount: document.getElementById("selectedMovieCount"),
  selectedMoviePoster: document.getElementById("selectedMoviePoster"),
  selectedMovieTitle: document.getElementById("selectedMovieTitle"),
  selectedMovieMeta: document.getElementById("selectedMovieMeta"),
  selectedMoviePlot: document.getElementById("selectedMoviePlot"),
  selectedMovieGenre: document.getElementById("selectedMovieGenre"),
  selectedMovieRating: document.getElementById("selectedMovieRating"),
  selectedMovieDirector: document.getElementById("selectedMovieDirector"),
  selectedMovieStars: document.getElementById("selectedMovieStars"),
  selectedFilesTableBody: document.getElementById("selectedFilesTableBody"),
  selectedFilesEmpty: document.getElementById("selectedFilesEmpty"),
  loadMoreFilesBtn: document.getElementById("loadMoreFilesBtn"),
  selectAllFilesBtn: document.getElementById("selectAllFilesBtn"),
  deleteSelectedFilesBtn: document.getElementById("deleteSelectedFilesBtn"),
  clearFileSelectionBtn: document.getElementById("clearFileSelectionBtn"),
  selectedMovieForm: document.getElementById("selectedMovieForm"),
  movieTitle: document.getElementById("movieTitle"),
  movieYear: document.getElementById("movieYear"),
  moviePoster: document.getElementById("moviePoster"),
  movieGenre: document.getElementById("movieGenre"),
  movieDirector: document.getElementById("movieDirector"),
  movieStars: document.getElementById("movieStars"),
  movieRating: document.getElementById("movieRating"),
  movieDescription: document.getElementById("movieDescription"),
  movieUpdateBtn: document.getElementById("movieUpdateBtn"),
  clearSelectionBtn: document.getElementById("clearSelectionBtn"),
  selectedFileInfo: document.getElementById("selectedFileInfo"),
  selectedFileName: document.getElementById("selectedFileName"),
  selectedFileResolution: document.getElementById("selectedFileResolution"),
  selectedFileSize: document.getElementById("selectedFileSize"),
  selectedFileMimeType: document.getElementById("selectedFileMimeType"),
  fileEditForm: document.getElementById("fileEditForm"),
  fileTitle: document.getElementById("fileTitle"),
  fileResolution: document.getElementById("fileResolution"),
  fileSize: document.getElementById("fileSize"),
  fileMimeType: document.getElementById("fileMimeType"),
  fileMovieId: document.getElementById("fileMovieId"),
  fileChannelId: document.getElementById("fileChannelId"),
  fileTelegramId: document.getElementById("fileTelegramId"),
  fileUpdateBtn: document.getElementById("fileUpdateBtn"),
  fileDeleteBtn: document.getElementById("fileDeleteBtn"),
  imdbQuery: document.getElementById("imdbQuery"),
  imdbYear: document.getElementById("imdbYear"),
  imdbSearchBtn: document.getElementById("imdbSearchBtn"),
  imdbResult: document.getElementById("imdbResult"),
  imdbResultPoster: document.getElementById("imdbResultPoster"),
  imdbResultContent: document.getElementById("imdbResultContent"),
  applyImdbToFileBtn: document.getElementById("applyImdbToFileBtn"),
  applyImdbToMovieBtn: document.getElementById("applyImdbToMovieBtn"),
  refreshSyncBtn: document.getElementById("refreshSyncBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
};

function getAuthHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...getAuthHeaders(), ...(options.headers || {}) };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    logout();
    throw new Error("Unauthorized. Please log in again.");
  }

  const text = await response.text();
  if (!text) {
    throw new Error(`Empty response from ${API_BASE}${path}`);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON response from ${API_BASE}${path}: ${text}`);
  }

  if (!body.success) {
    throw new Error(body.error || "Request failed");
  }

  return body;
}

function showLogin() {
  elements.adminScreen.classList.add("hidden");
  elements.loginScreen.classList.remove("hidden");
}

function showAdmin() {
  elements.loginScreen.classList.add("hidden");
  elements.adminScreen.classList.remove("hidden");
}

function showError(message) {
  elements.loginError.textContent = message;
  elements.loginError.classList.remove("hidden");
}

function clearError() {
  elements.loginError.textContent = "";
  elements.loginError.classList.add("hidden");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = "fixed bottom-5 right-5 rounded-3xl bg-slate-900 border border-slate-700 px-5 py-3 text-sm text-slate-100 shadow-2xl";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }
    button.innerHTML = loadingText;
    button.disabled = true;
    button.classList.add("opacity-70", "cursor-not-allowed");
  } else {
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
      delete button.dataset.originalText;
    }
    button.disabled = false;
    button.classList.remove("opacity-70", "cursor-not-allowed");
  }
}

async function init() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    showLogin();
    return;
  }

  try {
    await apiFetch("/check", { method: "GET" });
    showAdmin();
    await loadTitles();
    initFileSelectionState();
  } catch (err) {
    showLogin();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  clearError();
  const password = elements.adminPassword.value.trim();
  if (!password) {
    return showError("Please enter the admin password.");
  }

  setButtonLoading(elements.loginForm.querySelector('button[type="submit"]'), true, "Signing in...");
  try {
    const result = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await result.json();
    if (!data.success) {
      return showError(data.error || "Login failed.");
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    elements.adminPassword.value = "";
    showAdmin();
    await loadTitles();
    showToast("Logged in successfully.");
  } catch (err) {
    showError(err.message);
  } finally {
    setButtonLoading(elements.loginForm.querySelector('button[type="submit"]'), false);
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
  showToast("You have been logged out.");
}

async function loadTitles(search = "", reset = true) {
  if (state.isLoadingTitles) return;
  state.titleSearch = search;
  if (reset) {
    state.titlePage = 1;
    elements.titlesList.innerHTML = "";
    state.selectedMovieIds.clear();
  }

  setButtonLoading(elements.fileSearchBtn, true, "Loading...");
  state.isLoadingTitles = true;
  elements.titlesLoading.classList.remove("hidden");
  elements.titlesEmpty.classList.add("hidden");

  try {
    const params = new URLSearchParams({
      page: state.titlePage.toString(),
      limit: "20",
    });
    if (search) params.set("search", search);

    const result = await apiFetch(`/movies?${params.toString()}`);
    const movies = result.data || [];
    state.titleTotalPages = result.pagination?.totalPages || 1;

    if (reset) {
      state.titles = movies;
    } else {
      state.titles = state.titles.concat(movies);
    }

    if (reset && movies.length === 0) {
      elements.titlesEmpty.classList.remove("hidden");
    }

    renderTitles();
    state.titlePage += 1;
  } catch (err) {
    console.error(err);
    showToast("Unable to load movie titles.");
  } finally {
    state.isLoadingTitles = false;
    elements.titlesLoading.classList.add("hidden");
    setButtonLoading(elements.fileSearchBtn, false);
  }
}

function getMovieId(movie) {
  return movie.id || movie._id || movie.movieId || "";
}

function renderTitles() {
  elements.titlesList.innerHTML = "";
  (state.titles || []).forEach((movie) => {
    const movieId = getMovieId(movie);
    const isSelected = state.selectedMovieIds.has(movieId);
    const row = document.createElement("div");
    row.className = `w-full text-left rounded-3xl border px-5 py-4 shadow-inner transition ${isSelected ? "border-sky-400 bg-slate-900" : "border-slate-800 bg-slate-950"} hover:border-slate-500 hover:bg-slate-900`;
    row.innerHTML = `
      <div class="flex items-start gap-3">
        <label class="inline-flex items-center gap-2">
          <input type="checkbox" class="movie-select-checkbox accent-sky-500" ${isSelected ? "checked" : ""} />
        </label>
        <div class="flex-1">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="space-y-1">
              <p class="text-base sm:text-lg font-semibold text-slate-100">${escapeHtml(movie.title || "Untitled")}</p>
              <p class="text-sm text-slate-400">${escapeHtml(movie.year || "N/A")} · ${escapeHtml(movie.genre || "Unknown genre")}</p>
            </div>
            <div class="text-sm text-slate-400 sm:text-right">
              <p>${escapeHtml(movie.director || "Unknown director")}</p>
              <p class="mt-1">${escapeHtml(movie.stars || "No stars data")}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    const checkbox = row.querySelector(".movie-select-checkbox");
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSelectedMovie(movieId);
    });
    row.addEventListener("click", (event) => {
      if (event.target.closest(".movie-select-checkbox")) return;
      selectTitle(movie);
    });
    elements.titlesList.appendChild(row);
  });
}

function escapeHtml(value) {
  if (typeof value !== "string") return value;
  return value.replace(/[&<>"]/g, (chr) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[chr]));
}

function formatBytes(bytes) {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function extractReleaseTags(title) {
  const tags = [
    "NF-WEB",
    "NF-WB",
    "NF",
    "WEB-DL",
    "WEB",
    "HDTC",
    "HEVC",
    "HTS",
    "HTDS",
    "HTPC",
    "HTCP",
    "TELESYNC",
    "TS",
    "TC",
    "CAM",
    "DVDRIP",
    "HDRIP",
    "BLURAY",
    "BDRIP",
    "HDTV",
    "HDCAM",
    "BDR",
    "WEBRIP",
    "HC",
  ];

  if (typeof title !== "string") return [];

  const normalized = title.toUpperCase();
  const matches = [];

  tags.forEach((tag) => {
    const parts = tag.split(/[^A-Z0-9]+/).filter(Boolean);
    const regex = new RegExp(
      `\\b${parts.map((part) => part.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")).join("[.\\-_ ]+")}(?:\\b|$)`,
      "i"
    );

    if (regex.test(normalized) && !matches.includes(tag)) {
      matches.push(tag);
    }
  });

  return matches;
}

function selectTitle(title) {
  state.selectedTitle = title;
  state.selectedFiles = [];
  state.selectedFile = null;
  state.selectedFileIds.clear();
  state.displayFileCount = 10;
  state.imdbData = null;
  renderSelectedTitle();
  loadTitleDetails(title.id || title._id || title.movieId);
  loadTitleFiles(title.id || title._id || title.movieId);
}

function renderSelectedTitle() {
  if (!state.selectedTitle) {
    elements.selectedMovieCount.textContent = "No title selected";
    elements.selectedMoviePoster.src = "";
    elements.selectedMovieTitle.textContent = "Select a movie title to see related files.";
    elements.selectedMovieMeta.textContent = "";
    elements.selectedMoviePlot.textContent = "";
    elements.selectedMovieGenre.textContent = "";
    elements.selectedMovieRating.textContent = "";
    elements.selectedMovieDirector.textContent = "";
    elements.selectedMovieStars.textContent = "";
    elements.movieTitle.value = "";
    elements.movieYear.value = "";
    elements.moviePoster.value = "";
    elements.movieGenre.value = "";
    elements.movieDirector.value = "";
    elements.movieStars.value = "";
    elements.movieRating.value = "";
    elements.movieDescription.value = "";
    return;
  }

  const movie = state.selectedTitle;
  elements.selectedMovieCount.textContent = `${state.selectedFiles.length} files related`;
  elements.selectedMoviePoster.src = movie.poster || "";
  elements.selectedMovieTitle.textContent = `${movie.title || "Untitled"} (${movie.year || "?"})`;
  elements.selectedMovieMeta.textContent = `${movie.genre || "Unknown genre"} · ${movie.director || "Unknown director"}`;
  elements.selectedMoviePlot.textContent = movie.plot || movie.description || "No description available.";
  elements.selectedMovieGenre.textContent = movie.genre || "—";
  elements.selectedMovieRating.textContent = movie.imdbRating ? `IMDb ${movie.imdbRating}` : "—";
  elements.selectedMovieDirector.textContent = movie.director || "—";
  elements.selectedMovieStars.textContent = movie.stars || "—";

  elements.movieTitle.value = movie.title || "";
  elements.movieYear.value = movie.year || "";
  elements.moviePoster.value = movie.poster || "";
  elements.movieGenre.value = movie.genre || "";
  elements.movieDirector.value = movie.director || "";
  elements.movieStars.value = movie.stars || "";
  elements.movieRating.value = movie.imdbRating || "";
  elements.movieDescription.value = movie.plot || movie.description || "";
}

function updatePosterPreview() {
  const url = elements.moviePoster.value.trim();
  if (url) {
    elements.selectedMoviePoster.src = url;
  } else {
    elements.selectedMoviePoster.src = state.selectedTitle?.poster || "";
  }
}

async function loadTitleDetails(titleId) {
  if (!titleId) return;
  try {
    const result = await apiFetch(`/movies/${encodeURIComponent(titleId)}`);
    state.selectedTitle = result.data || state.selectedTitle;
    renderSelectedTitle();
  } catch (err) {
    console.error(err);
    showToast("Unable to load selected title details.");
  }
}

async function loadTitleFiles(titleId) {
  if (!titleId) return;
  try {
    const result = await apiFetch(`/movies/${encodeURIComponent(titleId)}/files`);
    state.selectedFiles = result.data || [];
    state.displayFileCount = 10;
    renderSelectedFiles();
    renderSelectedTitle();
  } catch (err) {
    console.error(err);
    showToast("Unable to load files for selected title.");
  }
}

function initFileSelectionState() {
  renderSelectedFile();
}


function getFileId(file) {
  console.log({file});
  return file.id || file.file_unique_id || file.fileId || "";
}

function renderSelectedFiles() {
  const files = state.selectedFiles || [];
  const visibleFiles = files.slice(0, state.displayFileCount);
  elements.selectedFilesTableBody.innerHTML = "";

  if (visibleFiles.length === 0) {
    elements.selectedFilesEmpty.classList.remove("hidden");
    elements.loadMoreFilesBtn.classList.add("hidden");
    elements.selectedMovieCount.textContent = "No related files found";
    return;
  }

  elements.selectedFilesEmpty.classList.add("hidden");
  elements.selectedMovieCount.textContent = `${files.length} files related`;

  visibleFiles.forEach((file) => {
    const fileId = getFileId(file);
    const isSelected = state.selectedFileIds.has(fileId);
    const tags = extractReleaseTags(file.title || "");
    conssole.log({file, tags});
    const badgesHtml = tags.length
      ? `<div class="mt-1 flex flex-wrap gap-1">${tags
          .map((t) => `<span class="text-xs px-2 py-1 rounded-full bg-sky-600 text-white">${escapeHtml(t)}</span>`)
          .join("")}</div>`
      : "";

    const row = document.createElement("tr");
    row.className = `table-row-button cursor-pointer hover:bg-slate-800 ${isSelected ? "bg-slate-900" : ""}`;
    row.innerHTML = `
      <td class="px-4 py-4">
        <input type="checkbox" class="file-select-checkbox accent-sky-500" ${isSelected ? "checked" : ""} />
      </td>
      <td class="px-4 py-4 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
        ${escapeHtml(file.title || "—")}
        ${badgesHtml}
      </td>
      <td class="px-4 py-4 max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap">${escapeHtml(file.resolution || "—")}</td>
      <td class="px-4 py-4">${file.fileSize ? formatBytes(file.fileSize) : "—"}</td>
      <td class="px-4 py-4 text-slate-400">${escapeHtml(file.channelId || "—")}</td>
    `;
    const checkbox = row.querySelector(".file-select-checkbox");
    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSelectedFile(fileId);
    });
    row.addEventListener("click", (event) => {
      if (event.target.closest(".file-select-checkbox")) return;
      selectFile(file);
    });
    elements.selectedFilesTableBody.appendChild(row);
  });

  if (files.length > state.displayFileCount) {
    elements.loadMoreFilesBtn.classList.remove("hidden");
  } else {
    elements.loadMoreFilesBtn.classList.add("hidden");
  }
}

function loadMoreFiles() {
  state.displayFileCount += 10;
  renderSelectedFiles();
}

function toggleSelectedMovie(movieId) {
  if (!movieId) return;
  if (state.selectedMovieIds.has(movieId)) {
    state.selectedMovieIds.delete(movieId);
  } else {
    state.selectedMovieIds.add(movieId);
  }
  renderTitles();
}

function clearSelectedMovieSelection() {
  state.selectedMovieIds.clear();
  renderTitles();
}

function toggleSelectedFile(fileId) {
  if (!fileId) return;
  if (state.selectedFileIds.has(fileId)) {
    state.selectedFileIds.delete(fileId);
  } else {
    state.selectedFileIds.add(fileId);
  }
  renderSelectedFiles();
}

function clearSelectedFileSelection() {
  state.selectedFileIds.clear();
  renderSelectedFiles();
}

function selectAllMovies() {
  if (!state.titles || state.titles.length === 0) {
    showToast("No movies loaded to select.");
    return;
  }
  state.titles.forEach((movie) => {
    const movieId = getMovieId(movie);
    if (movieId) {
      state.selectedMovieIds.add(movieId);
    }
  });
  renderTitles();
  showToast(`Selected all ${state.selectedMovieIds.size} loaded movies.`);
}

function selectAllFiles() {
  if (!state.selectedFiles || state.selectedFiles.length === 0) {
    showToast("No files loaded to select.");
    return;
  }
  state.selectedFiles.forEach((file) => {
    const fileId = getFileId(file);
    if (fileId) {
      state.selectedFileIds.add(fileId);
    }
  });
  renderSelectedFiles();
  showToast(`Selected all ${state.selectedFileIds.size} loaded files.`);
}

async function handleDeleteSelectedMovies() {
  const selectedIds = Array.from(state.selectedMovieIds);
  if (selectedIds.length === 0) {
    return showToast("No selected movies to delete.");
  }
  if (!confirm(`Delete ${selectedIds.length} selected movie(s) and all related files? This cannot be undone.`)) {
    return;
  }

  setButtonLoading(elements.deleteSelectedMoviesBtn, true, "Deleting...");
  try {
    for (const movieId of selectedIds) {
      await apiFetch(`/movies/${encodeURIComponent(movieId)}`, { method: "DELETE" });
    }
    showToast("Selected movie(s) deleted successfully.");
    state.selectedMovieIds.clear();
    if (state.selectedTitle && selectedIds.includes(getMovieId(state.selectedTitle))) {
      state.selectedTitle = null;
      state.selectedFiles = [];
      state.selectedFile = null;
      state.imdbData = null;
      renderSelectedTitle();
      renderSelectedFiles();
    }
    await loadTitles(state.titleSearch, true);
  } catch (err) {
    console.error(err);
    showToast("Unable to delete selected movies.");
  } finally {
    setButtonLoading(elements.deleteSelectedMoviesBtn, false);
  }
}

async function handleDeleteSelectedFiles() {
  const selectedIds = Array.from(state.selectedFileIds);
  if (selectedIds.length === 0) {
    return showToast("No selected files to delete.");
  }
  if (!confirm(`Delete ${selectedIds.length} selected file(s)? This cannot be undone.`)) {
    return;
  }

  setButtonLoading(elements.deleteSelectedFilesBtn, true, "Deleting...");
  try {
    for (const fileId of selectedIds) {
      await apiFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
    }
    showToast("Selected file(s) deleted successfully.");
    state.selectedFileIds.clear();
    if (state.selectedFile && selectedIds.includes(getFileId(state.selectedFile))) {
      state.selectedFile = null;
      renderSelectedFile();
    }
    if (state.selectedTitle) {
      await loadTitleFiles(state.selectedTitle.id || state.selectedTitle._id || state.selectedTitle.movieId);
    }
  } catch (err) {
    console.error(err);
    showToast("Unable to delete selected files.");
  } finally {
    setButtonLoading(elements.deleteSelectedFilesBtn, false);
  }
}

function selectFile(file) {
  state.selectedFile = file;
  state.imdbData = null;
  renderSelectedFile();
}

async function renderSelectedFile() {
  if (!state.selectedFile) {
    elements.fileEditForm.reset();
    elements.fileUpdateBtn.disabled = true;
    elements.fileDeleteBtn.disabled = true;
    elements.selectedFileInfo.classList.add("hidden");
    return;
  }

  elements.selectedFileInfo.classList.remove("hidden");
  elements.fileUpdateBtn.disabled = false;
  elements.fileDeleteBtn.disabled = false;
  
  // Display file info
  elements.selectedFileName.textContent = state.selectedFile.title || "—";
  elements.selectedFileResolution.textContent = state.selectedFile.resolution || "—";
  elements.selectedFileSize.textContent = formatBytes(state.selectedFile.fileSize) || "—";
  elements.selectedFileMimeType.textContent = state.selectedFile.mimeType || "—";
  
  // Populate edit form
  elements.fileTitle.value = state.selectedFile.title || "";
  elements.fileResolution.value = state.selectedFile.resolution || "";
  elements.fileSize.value = state.selectedFile.fileSize || 0;
  elements.fileMimeType.value = state.selectedFile.mimeType || "";
  elements.fileMovieId.value = state.selectedFile.movieId || "";
  elements.fileChannelId.value = state.selectedFile.channelId || "";
  elements.fileTelegramId.value = state.selectedFile.fileId || "";
}

async function handleFileUpdate() {
  if (!state.selectedFile) return;

  const payload = {
    title: elements.fileTitle.value.trim(),
    resolution: elements.fileResolution.value.trim(),
    fileSize: parseInt(elements.fileSize.value, 10) || 0,
    mimeType: elements.fileMimeType.value.trim(),
    movieId: elements.fileMovieId.value.trim() || null,
    channelId: elements.fileChannelId.value.trim(),
    fileId: elements.fileTelegramId.value.trim(),
  };

  const fileId = getFileId(state.selectedFile);
  if (!fileId) return showToast("Unable to determine file ID for update.");

  setButtonLoading(elements.fileUpdateBtn, true, "Saving...");
  try {
    const result = await apiFetch(`/files/${encodeURIComponent(fileId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    state.selectedFile = result.data;
    showToast("File updated successfully.");
    if (state.selectedTitle) {
      await loadTitleFiles(state.selectedTitle.id || state.selectedTitle._id || state.selectedTitle.movieId);
    }
    renderSelectedFile();
  } catch (err) {
    console.error(err);
    showToast("Unable to update file.");
  } finally {
    setButtonLoading(elements.fileUpdateBtn, false);
  }
}

async function handleFileDelete() {
  if (!state.selectedFile) return;
  if (!confirm("Delete this file record? This cannot be undone.")) return;

  const fileId = getFileId(state.selectedFile);
  if (!fileId) return showToast("Unable to determine file ID for deletion.");

  setButtonLoading(elements.fileDeleteBtn, true, "Deleting...");
  try {
    await apiFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
    showToast("File deleted successfully.");
    state.selectedFile = null;
    renderSelectedFile();
    if (state.selectedTitle) {
      await loadTitleFiles(state.selectedTitle.id || state.selectedTitle._id || state.selectedTitle.movieId);
    }
  } catch (err) {
    console.error(err);
    showToast("Unable to delete file.");
  } finally {
    setButtonLoading(elements.fileDeleteBtn, false);
  }
}

async function handleImdbSearch() {
  const query = elements.imdbQuery.value.trim();
  const year = elements.imdbYear.value.trim();
  if (!query) {
    return showToast("Enter a movie title to search IMDb.");
  }

  setButtonLoading(elements.imdbSearchBtn, true, "Searching...");
  try {
    const params = new URLSearchParams({ q: query });
    if (year) params.set("year", year);
    const result = await apiFetch(`/imdb-search?${params.toString()}`);
    if (!result.data) {
      throw new Error("No IMDb result found for that query.");
    }
    state.imdbData = result.data;
    renderImdbResult();
    showToast("IMDb metadata loaded.");
  } catch (err) {
    console.error(err);
    showToast(err.message || "IMDb search failed.");
  } finally {
    setButtonLoading(elements.imdbSearchBtn, false);
  }
}

function renderImdbResult() {
  if (!state.imdbData) {
    elements.imdbResult.classList.add("hidden");
    return;
  }

  const metadata = state.imdbData;
  elements.imdbResultPoster.src = metadata.poster || "https://placehold.co/300x450/111827/FFFFFF/png?text=No+Poster";
  elements.imdbResultPoster.alt = `${metadata.title || "IMDb"} poster`;
  elements.imdbResultContent.innerHTML = `
    <p><strong>Title:</strong> ${escapeHtml(metadata.title || "N/A")}</p>
    <p><strong>Year:</strong> ${escapeHtml(metadata.year || "N/A")}</p>
    <p><strong>Genre:</strong> ${escapeHtml(metadata.genre || "N/A")}</p>
    <p><strong>Rating:</strong> ${escapeHtml(metadata.imdbRating || "N/A")}</p>
    <p><strong>Director:</strong> ${escapeHtml(metadata.director || "N/A")}</p>
    <p><strong>Stars:</strong> ${escapeHtml(metadata.stars || "N/A")}</p>
    <p class="text-slate-400 text-sm mt-2">${escapeHtml(metadata.plot || metadata.description || "No plot available.")}</p>
  `;
  elements.imdbResult.classList.remove("hidden");
}

async function handleApplyImdbToFile() {
  if (!state.selectedFile || !state.imdbData) {
    return showToast("Select a file and load IMDb data first.");
  }

  const payload = {
    title: state.imdbData.title || state.selectedFile.title || "",
  };

  const fileId = getFileId(state.selectedFile);
  if (!fileId) return showToast("Unable to determine file ID for IMDb update.");

  setButtonLoading(elements.applyImdbToFileBtn, true, "Updating...");
  try {
    const result = await apiFetch(`/files/${encodeURIComponent(fileId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    // update selectedFile and UI
    state.selectedFile = result.data;
    renderSelectedFile();
    showToast("Selected file title updated from IMDb metadata.");

    // refresh file list for the current movie if any
    if (state.selectedTitle) {
      await loadTitleFiles(state.selectedTitle.id || state.selectedTitle._id || state.selectedTitle.movieId);
    }
  } catch (err) {
    console.error(err);
    showToast("Unable to update file from IMDb: " + (err.message || "Unknown error"));
  } finally {
    setButtonLoading(elements.applyImdbToFileBtn, false);
  }
}

async function handleApplyImdbToMovie() {
  if (!state.imdbData) {
    return showToast("No IMDb data available. Search for a title first.");
  }
  const titleId = state.selectedTitle?.id || state.selectedTitle?._id || state.selectedTitle?.movieId;
  if (!titleId) {
    return showToast("Select a title before applying IMDb data.");
  }

  setButtonLoading(elements.applyImdbToMovieBtn, true, "Updating...");
  try {
    const plotDescription = state.imdbData.plot || state.imdbData.description || "";
    const payload = {
      title: state.imdbData.title || "",
      year: state.imdbData.year || "",
      poster: state.imdbData.poster || "",
      genre: state.imdbData.genre || "",
      director: state.imdbData.director || "",
      stars: state.imdbData.stars || "",
      imdbRating: state.imdbData.imdbRating || "",
      description: plotDescription,
      plot: plotDescription,
    };

    await apiFetch(`/movies/${encodeURIComponent(titleId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    await loadTitleDetails(titleId);
    showToast("Movie metadata updated from IMDb.");
  } catch (err) {
    console.error(err);
    showToast("Unable to update movie from IMDb: " + (err.message || "Unknown error"));
  } finally {
    setButtonLoading(elements.applyImdbToMovieBtn, false);
  }
}

async function handleMovieUpdate() {
  if (!state.selectedTitle) return;
  const titleId = state.selectedTitle?.id || state.selectedTitle?._id || state.selectedTitle?.movieId;
  if (!titleId) return showToast("Select a title before saving movie details.");

  const payload = {
    title: elements.movieTitle.value.trim(),
    year: elements.movieYear.value.trim(),
    poster: elements.moviePoster.value.trim(),
    genre: elements.movieGenre.value.trim(),
    director: elements.movieDirector.value.trim(),
    stars: elements.movieStars.value.trim(),
    imdbRating: elements.movieRating.value.trim(),
    description: elements.movieDescription.value.trim(),
    plot: elements.movieDescription.value.trim(),
  };

  setButtonLoading(elements.movieUpdateBtn, true, "Saving...");
  try {
    const result = await apiFetch(`/movies/${encodeURIComponent(titleId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    state.selectedTitle = result.data;
    renderSelectedTitle();
    showToast("Movie details updated successfully.");
  } catch (err) {
    console.error(err);
    showToast("Unable to update movie details.");
  } finally {
    setButtonLoading(elements.movieUpdateBtn, false);
  }
}

async function handleRefreshSync() {
  setButtonLoading(elements.refreshSyncBtn, true, "Refreshing...");
  try {
    await apiFetch(`/refresh-sync`, { method: "POST" });
    showToast("Sync refreshed successfully.");
    await loadTitles(state.titleSearch, true);
  } catch (err) {
    console.error(err);
    showToast("Unable to refresh sync.");
  } finally {
    setButtonLoading(elements.refreshSyncBtn, false);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.fileSearchBtn.addEventListener("click", () => loadTitles(elements.fileSearch.value.trim(), true));
  elements.fileSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadTitles(elements.fileSearch.value.trim(), true);
    }
  });
  elements.titlesWrapper.addEventListener("scroll", () => {
    const wrapper = elements.titlesWrapper;
    if (!wrapper || state.isLoadingTitles) return;
    if (wrapper.scrollTop + wrapper.clientHeight >= wrapper.scrollHeight - 100) {
      if (state.titlePage <= state.titleTotalPages) {
        loadTitles(state.titleSearch, false);
      }
    }
  });
  elements.clearSelectionBtn.addEventListener("click", () => {
    state.selectedTitle = null;
    state.selectedFiles = [];
    state.selectedFile = null;
    state.imdbData = null;
    state.selectedMovieIds.clear();
    state.selectedFileIds.clear();
    renderSelectedTitle();
    renderSelectedFiles();
    renderSelectedFile();
    elements.imdbResult.classList.add("hidden");
  });
  elements.deleteSelectedFilesBtn.addEventListener("click", handleDeleteSelectedFiles);
  elements.selectAllFilesBtn.addEventListener("click", selectAllFiles);
  elements.clearFileSelectionBtn.addEventListener("click", clearSelectedFileSelection);
  elements.deleteSelectedMoviesBtn.addEventListener("click", handleDeleteSelectedMovies);
  elements.selectAllMoviesBtn.addEventListener("click", selectAllMovies);
  elements.clearMovieSelectionBtn.addEventListener("click", clearSelectedMovieSelection);
  elements.fileUpdateBtn.addEventListener("click", handleFileUpdate);
  elements.fileDeleteBtn.addEventListener("click", handleFileDelete);
  elements.imdbSearchBtn.addEventListener("click", handleImdbSearch);
  elements.applyImdbToFileBtn.addEventListener("click", handleApplyImdbToFile);
  elements.applyImdbToMovieBtn.addEventListener("click", handleApplyImdbToMovie);
  elements.movieUpdateBtn.addEventListener("click", handleMovieUpdate);
  elements.moviePoster.addEventListener("input", updatePosterPreview);
  elements.loadMoreFilesBtn.addEventListener("click", loadMoreFiles);
  elements.refreshSyncBtn.addEventListener("click", handleRefreshSync);
  elements.logoutBtn.addEventListener("click", logout);
}

window.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  init();
});
