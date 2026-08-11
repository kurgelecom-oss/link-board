(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/app.js
  (() => {
    const normPath = (p) => {
      const t = p.replace(/\/+$/, "");
      return t === "" ? "/" : t;
    };
    const host = location.hostname, path = normPath(location.pathname);
    document.querySelectorAll(".topnav-link").forEach((a) => {
      const u = new URL(a.href);
      if (u.hostname === host && normPath(u.pathname) === path) a.classList.add("active");
    });
  })();
  var STORAGE_KEY = "linkBoard_links";
  var TOKEN_KEY = "linkBoard_writeToken";
  var API_URL = "/api/links";
  var links = [];
  var editingIndex = null;
  var pendingAddImage = null;
  var pendingEditImage = null;
  var clearEditImage = false;
  var pendingAddPdf = null;
  var pendingEditPdf = null;
  var clearEditPdf = false;
  var MAX_PDF_ENCODED = 4 * 1024 * 1024;
  var MAX_BOARD_BYTES = 5 * 1024 * 1024;
  var DEFAULT_LINKS = [
    { name: "Time Allocation Board", url: "https://kurgel-dashboard.netlify.app/board" },
    { name: "Family Dashboard", url: "https://kurgel-dashboard.netlify.app/" },
    { name: "Ecom Launchpad (THE ENGINE)", url: "https://ecom-launchpad-mentor.netlify.app/" },
    { name: "Product Test Engine", url: "https://product-test-engine.netlify.app/" },
    { name: "LIARE Store", url: "https://tryliare.shop/" },
    { name: "LIARE PDP", url: "https://tryliare.shop/products/liare" },
    { name: "Korean Hair Growth Serum PDP", url: "https://tryliare.shop/products/korean-hair-growth-serum" }
  ];
  function setSyncStatus(text, isError) {
    const el = document.getElementById("syncStatus");
    el.textContent = text;
    el.classList.toggle("error", !!isError);
  }
  function normalizeUrl(u) {
    return u.replace(/\/+$/, "");
  }
  var RETIRED_URLS = {
    "https://time-allocation-board.netlify.app": "https://kurgel-dashboard.netlify.app/board"
  };
  function mergeDefaults(list) {
    const merged = list.map((l) => {
      const to = l.url && RETIRED_URLS[normalizeUrl(l.url)];
      return to ? __spreadProps(__spreadValues({}, l), { url: to }) : l;
    });
    DEFAULT_LINKS.forEach((d) => {
      if (!merged.some((l) => l.url && normalizeUrl(l.url) === normalizeUrl(d.url))) {
        merged.push(d);
      }
    });
    return merged;
  }
  async function loadLinks() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      links = JSON.parse(cached);
      renderLinks();
    }
    setSyncStatus("Syncing\u2026");
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed: " + res.status);
      const cloudLinks = await res.json();
      const merged = mergeDefaults(cloudLinks);
      links = merged;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
      renderLinks();
      setSyncStatus("Synced across devices");
      if (merged.length !== cloudLinks.length) {
        await persistLinks();
      }
    } catch (err) {
      links = mergeDefaults(links);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
      renderLinks();
      setSyncStatus("Offline \u2014 showing cached links (changes will sync when back online)", true);
    }
  }
  async function persistLinks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    const oversize = checkBoardSize(links);
    if (oversize) {
      setSyncStatus("Saved locally only \u2014 " + oversize, true);
      return false;
    }
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) {
      setSyncStatus("Saved locally only \u2014 enter your Sync Token to save to the cloud", true);
      showSyncTokenSection();
      return false;
    }
    try {
      const res = await fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-link-board-token": token },
        body: JSON.stringify(links)
      });
      if (res.status === 401) {
        setSyncStatus("Saved locally only \u2014 Sync Token is wrong, check it", true);
        showSyncTokenSection();
        return false;
      }
      if (!res.ok) throw new Error("save failed: " + res.status);
      setSyncStatus("Synced across devices");
      return true;
    } catch (err) {
      setSyncStatus("Saved locally \u2014 could not reach cloud (check connection)", true);
      return false;
    }
  }
  function resizeImage(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function fmtMb(bytes) {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }
  function readPdf(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.onload = () => {
        const data = reader.result;
        if (!/^data:application\/pdf;base64,/.test(data)) {
          reject(new Error("That file is not a readable PDF."));
          return;
        }
        if (data.length > MAX_PDF_ENCODED) {
          reject(new Error(
            "That PDF is too big to sync: ".concat(fmtMb(file.size), " file becomes ").concat(fmtMb(data.length), " once encoded. ") + "The limit is ".concat(fmtMb(MAX_PDF_ENCODED), " encoded (roughly a 3 MB PDF). Compress it and try again.")
          ));
          return;
        }
        resolve({ data, name: file.name });
      };
      reader.readAsDataURL(file);
    });
  }
  function checkBoardSize(candidate) {
    const bytes = new Blob([JSON.stringify(candidate)]).size;
    if (bytes <= MAX_BOARD_BYTES) return null;
    return "Saving this would make the board ".concat(fmtMb(bytes), ", over the ").concat(fmtMb(MAX_BOARD_BYTES), " sync limit. ") + "Delete an existing PDF or image tile first.";
  }
  function setPdfChip(chipId, name) {
    const chip = document.getElementById(chipId);
    if (name) {
      chip.textContent = name;
      chip.classList.add("active");
    } else {
      chip.textContent = "";
      chip.classList.remove("active");
    }
  }
  document.getElementById("linkImage").addEventListener("change", async function(e) {
    const file = e.target.files[0];
    pendingAddImage = null;
    pendingAddPdf = null;
    document.getElementById("linkImagePreview").classList.remove("active");
    setPdfChip("linkPdfChip", null);
    if (!file) return;
    if (file.type === "application/pdf") {
      try {
        pendingAddPdf = await readPdf(file);
      } catch (err) {
        alert(err.message);
        this.value = "";
        return;
      }
      setPdfChip("linkPdfChip", pendingAddPdf.name);
      return;
    }
    pendingAddImage = await resizeImage(file, 800, 0.8);
    const preview = document.getElementById("linkImagePreview");
    preview.src = pendingAddImage;
    preview.classList.add("active");
  });
  document.getElementById("editImage").addEventListener("change", async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === "application/pdf") {
      let picked;
      try {
        picked = await readPdf(file);
      } catch (err) {
        alert(err.message);
        this.value = "";
        return;
      }
      pendingEditPdf = picked;
      clearEditPdf = false;
      setPdfChip("editPdfChip", picked.name);
      document.getElementById("removeEditPdfLink").style.display = "inline";
      return;
    }
    pendingEditImage = await resizeImage(file, 800, 0.8);
    clearEditImage = false;
    document.getElementById("removeEditImageLink").style.display = "inline";
    const preview = document.getElementById("editImagePreview");
    preview.src = pendingEditImage;
    preview.classList.add("active");
  });
  async function addLink() {
    const name = document.getElementById("linkName").value.trim();
    const url = document.getElementById("linkUrl").value.trim();
    if (!name || !url && !pendingAddImage && !pendingAddPdf) {
      alert("Please provide a name, and either a URL, an image, or a PDF");
      return;
    }
    const link = { name };
    if (url) link.url = url;
    if (pendingAddImage) link.image = pendingAddImage;
    if (pendingAddPdf) {
      link.pdf = pendingAddPdf.data;
      link.pdfName = pendingAddPdf.name;
    }
    const tooBig = checkBoardSize(links.concat([link]));
    if (tooBig) {
      alert(tooBig);
      return;
    }
    const btn = document.getElementById("addLinkBtn");
    btn.disabled = true;
    btn.textContent = "Saving\u2026";
    links.push(link);
    await persistLinks();
    renderLinks();
    document.getElementById("linkName").value = "";
    document.getElementById("linkUrl").value = "";
    document.getElementById("linkImage").value = "";
    document.getElementById("linkImagePreview").classList.remove("active");
    setPdfChip("linkPdfChip", null);
    pendingAddImage = null;
    pendingAddPdf = null;
    btn.disabled = false;
    btn.textContent = "Add";
    hideAddForm();
  }
  async function deleteLink(index) {
    if (confirm("Delete this link?")) {
      links.splice(index, 1);
      renderLinks();
      await persistLinks();
    }
  }
  function openEditModal(index) {
    editingIndex = index;
    pendingEditImage = null;
    clearEditImage = false;
    pendingEditPdf = null;
    clearEditPdf = false;
    const link = links[index];
    document.getElementById("editName").value = link.name;
    document.getElementById("editUrl").value = link.url || "";
    document.getElementById("editImage").value = "";
    const preview = document.getElementById("editImagePreview");
    const removeLink = document.getElementById("removeEditImageLink");
    const img = safeImage(link.image);
    if (img) {
      preview.src = img;
      preview.classList.add("active");
      removeLink.style.display = "inline";
    } else {
      preview.classList.remove("active");
      removeLink.style.display = "none";
    }
    const removePdfLink = document.getElementById("removeEditPdfLink");
    if (safePdf(link.pdf)) {
      setPdfChip("editPdfChip", link.pdfName || "document.pdf");
      removePdfLink.style.display = "inline";
    } else {
      setPdfChip("editPdfChip", null);
      removePdfLink.style.display = "none";
    }
    document.getElementById("editModal").classList.add("active");
  }
  function removeEditImage(e) {
    if (e) e.preventDefault();
    pendingEditImage = null;
    clearEditImage = true;
    document.getElementById("editImage").value = "";
    const preview = document.getElementById("editImagePreview");
    preview.classList.remove("active");
    document.getElementById("removeEditImageLink").style.display = "none";
  }
  function removeEditPdf(e) {
    if (e) e.preventDefault();
    pendingEditPdf = null;
    clearEditPdf = true;
    document.getElementById("editImage").value = "";
    setPdfChip("editPdfChip", null);
    document.getElementById("removeEditPdfLink").style.display = "none";
  }
  function closeModal() {
    document.getElementById("editModal").classList.remove("active");
    editingIndex = null;
    pendingEditImage = null;
    clearEditImage = false;
    pendingEditPdf = null;
    clearEditPdf = false;
  }
  async function saveEdit() {
    const name = document.getElementById("editName").value.trim();
    const url = document.getElementById("editUrl").value.trim();
    const existing = links[editingIndex];
    const willHaveImage = pendingEditImage || !clearEditImage && existing.image;
    const willHavePdf = pendingEditPdf || !clearEditPdf && existing.pdf;
    if (!name || !url && !willHaveImage && !willHavePdf) {
      alert("Please provide a name, and either a URL, an image, or a PDF");
      return;
    }
    const updated = { name };
    if (url) updated.url = url;
    if (pendingEditImage) updated.image = pendingEditImage;
    else if (!clearEditImage && existing.image) updated.image = existing.image;
    if (pendingEditPdf) {
      updated.pdf = pendingEditPdf.data;
      updated.pdfName = pendingEditPdf.name;
    } else if (!clearEditPdf && existing.pdf) {
      updated.pdf = existing.pdf;
      if (existing.pdfName) updated.pdfName = existing.pdfName;
    }
    const candidate = links.slice();
    candidate[editingIndex] = updated;
    const tooBig = checkBoardSize(candidate);
    if (tooBig) {
      alert(tooBig);
      return;
    }
    const btn = document.getElementById("saveEditBtn");
    btn.disabled = true;
    btn.textContent = "Saving\u2026";
    links[editingIndex] = updated;
    await persistLinks();
    closeModal();
    renderLinks();
    btn.disabled = false;
    btn.textContent = "Save";
  }
  function openLink(url) {
    window.open(url, "_blank");
  }
  function openImageLightbox(imgSrc) {
    const lightbox = document.getElementById("lightbox");
    document.getElementById("lightboxImg").src = imgSrc;
    lightbox.classList.add("active");
  }
  function closeLightbox() {
    document.getElementById("lightbox").classList.remove("active");
  }
  document.addEventListener("keydown", function(e) {
    if (e.key !== "Escape") return;
    closeLightbox();
    closeModal();
  });
  var SAFE_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
  var SAFE_PDF_RE = /^data:application\/pdf;base64,[A-Za-z0-9+/]+=*$/;
  function safeImage(image) {
    return typeof image === "string" && SAFE_IMAGE_RE.test(image) ? image : null;
  }
  function safePdf(pdf) {
    return typeof pdf === "string" && SAFE_PDF_RE.test(pdf) ? pdf : null;
  }
  function pdfBlobUrl(link) {
    const data = safePdf(link && link.pdf);
    if (!data) return null;
    const binary = atob(data.slice(data.indexOf(",") + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  }
  function pdfFileName(link) {
    return link && link.pdfName || "document.pdf";
  }
  function downloadPdfUrl(blobUrl, filename) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 6e4);
  }
  function downloadPdf(index) {
    const link = links[index];
    const blobUrl = pdfBlobUrl(link);
    if (!blobUrl) return;
    downloadPdfUrl(blobUrl, pdfFileName(link));
  }
  function openPdf(index) {
    const link = links[index];
    const blobUrl = pdfBlobUrl(link);
    if (!blobUrl) return;
    let win = null;
    try {
      win = window.open(blobUrl, "_blank");
    } catch (err) {
      win = null;
    }
    if (!win || win.closed || typeof win.closed === "undefined") {
      downloadPdfUrl(blobUrl, pdfFileName(link));
      return;
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 6e4);
  }
  var TILE_GRADIENTS = [
    "linear-gradient(135deg,#ff5f6d,#ffc371)",
    "linear-gradient(135deg,#4facfe,#00f2fe)",
    "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    "linear-gradient(135deg,#f6d365,#fda085)",
    "linear-gradient(135deg,#43e97b,#38f9d7)",
    "linear-gradient(135deg,#fa709a,#fee140)",
    "linear-gradient(135deg,#30cfd0,#7b2ff7)",
    "linear-gradient(135deg,#ff9a8b,#ff6a88)"
  ];
  function tileGradient(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = hash * 31 + seed.charCodeAt(i) | 0;
    }
    return TILE_GRADIENTS[Math.abs(hash) % TILE_GRADIENTS.length];
  }
  function renderLinks() {
    const container = document.getElementById("linksList");
    const tiles = links.map((link, index) => {
      const img = safeImage(link.image);
      const pdf = safePdf(link.pdf);
      const pdfName = pdf ? link.pdfName || "document.pdf" : "";
      const openTarget = link.url || "";
      const background = img ? "background:#181b21;" : "background:".concat(tileGradient(link.name + (link.url || "")), ";");
      const onclick = openTarget ? "openLink('".concat(escapeHtml(openTarget), "')") : pdf ? "openPdf(".concat(index, ")") : img ? "openImageLightbox('".concat(escapeHtml(img), "')") : "";
      const hoverTitle = pdf ? "".concat(link.name, " \u2014 ").concat(pdfName) : link.name;
      return '\n        <div class="tile" style="'.concat(background, '" ').concat(onclick ? 'onclick="'.concat(onclick, '"') : "", ' title="').concat(escapeHtml(hoverTitle), '">\n            ').concat(img ? '<img class="tile-image" src="'.concat(escapeHtml(img), '" alt="').concat(escapeHtml(link.name), '">') : "", '\n            <div class="tile-scrim"></div>\n            ').concat(pdf ? '<div class="tile-pdf-badge" title="'.concat(escapeHtml(pdfName), '">&#128196; PDF</div>') : "", '\n            <div class="tile-name">').concat(escapeHtml(link.name), '</div>\n            <div class="tile-actions">\n                ').concat(pdf ? '<button class="tile-action-btn" onclick="event.stopPropagation(); downloadPdf('.concat(index, ')" aria-label="Download PDF" title="Download ').concat(escapeHtml(pdfName), '">&#11015;</button>') : "", '\n                <button class="tile-action-btn" onclick="event.stopPropagation(); openEditModal(').concat(index, ')" aria-label="Edit" title="Edit">&#9998;</button>\n                <button class="tile-action-btn delete" onclick="event.stopPropagation(); deleteLink(').concat(index, ')" aria-label="Delete" title="Delete">&#128465;</button>\n            </div>\n        </div>\n    ');
    }).join("");
    const addTile = '<div class="tile tile-add" onclick="showAddForm()" title="Add a link, image, or PDF"><span class="tile-add-plus">+</span></div>';
    container.innerHTML = tiles + addTile;
  }
  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  document.getElementById("editModal").addEventListener("click", function(e) {
    if (e.target === this) closeModal();
  });
  var syncTokenInput = document.getElementById("syncToken");
  syncTokenInput.value = localStorage.getItem(TOKEN_KEY) || "";
  function showSyncTokenSection() {
    document.getElementById("syncTokenSection").style.display = "block";
  }
  function hideSyncTokenSection() {
    document.getElementById("syncTokenSection").style.display = "none";
  }
  function toggleSyncTokenSection(e) {
    if (e) e.preventDefault();
    const section = document.getElementById("syncTokenSection");
    if (section.style.display === "none") showSyncTokenSection();
    else hideSyncTokenSection();
  }
  if (!localStorage.getItem(TOKEN_KEY)) showSyncTokenSection();
  function saveSyncToken() {
    const val = syncTokenInput.value.trim();
    if (val) localStorage.setItem(TOKEN_KEY, val);
    else localStorage.removeItem(TOKEN_KEY);
    const btn = document.getElementById("saveTokenBtn");
    const original = btn.textContent;
    btn.textContent = val ? "Saved \u2713" : "Cleared";
    setTimeout(() => {
      btn.textContent = original;
      if (val) hideSyncTokenSection();
    }, 1200);
    if (val) setSyncStatus("Sync Token saved on this device");
  }
  syncTokenInput.addEventListener("keypress", function(e) {
    if (e.key === "Enter") saveSyncToken();
  });
  function showAddForm() {
    document.getElementById("addFormSection").style.display = "block";
    document.getElementById("linkName").focus();
    document.getElementById("addFormSection").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function hideAddForm() {
    document.getElementById("addFormSection").style.display = "none";
  }
  document.getElementById("linkName").addEventListener("keypress", function(e) {
    if (e.key === "Enter") document.getElementById("linkUrl").focus();
  });
  document.getElementById("linkUrl").addEventListener("keypress", function(e) {
    if (e.key === "Enter") addLink();
  });
  window.addLink = addLink;
  window.closeLightbox = closeLightbox;
  window.closeModal = closeModal;
  window.deleteLink = deleteLink;
  window.downloadPdf = downloadPdf;
  window.hideAddForm = hideAddForm;
  window.hideSyncTokenSection = hideSyncTokenSection;
  window.openEditModal = openEditModal;
  window.openImageLightbox = openImageLightbox;
  window.openLink = openLink;
  window.openPdf = openPdf;
  window.removeEditImage = removeEditImage;
  window.removeEditPdf = removeEditPdf;
  window.saveEdit = saveEdit;
  window.saveSyncToken = saveSyncToken;
  window.showAddForm = showAddForm;
  window.toggleSyncTokenSection = toggleSyncTokenSection;
  loadLinks();
})();
