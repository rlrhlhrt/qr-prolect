(function () {
  "use strict";

  const form = document.getElementById("record-form");
  const itemNameInput = document.getElementById("item_name");
  const fullNameInput = document.getElementById("full_name");
  const addressInput = document.getElementById("address");
  const phoneInput = document.getElementById("phone");
  const formMessage = document.getElementById("form-message");
  const btnAdd = document.getElementById("btn-add");
  const qrImage = document.getElementById("qr-image");
  const qrPlaceholder = document.getElementById("qr-placeholder");
  const btnDownloadPng = document.getElementById("btn-download-png");
  const btnPrint = document.getElementById("btn-print");
  const btnExportJson = document.getElementById("btn-export-json");
  const historyTbody = document.getElementById("history-tbody");
  const printQr = document.getElementById("print-qr");

  const btnAddDefaultLabel = btnAdd.textContent.trim();

  let currentQrBase64 = null;
  let currentItemNameForFile = "item";
  let generateFlashTimer = null;

  function setFormMessage(text, kind) {
    formMessage.textContent = text || "";
    formMessage.classList.remove("error", "ok");
    if (kind) {
      formMessage.classList.add(kind);
    }
  }

  function clearFormInputs() {
    itemNameInput.value = "";
    fullNameInput.value = "";
    addressInput.value = "";
    phoneInput.value = "";
  }

  function flashGenerateButton() {
    if (generateFlashTimer !== null) {
      window.clearTimeout(generateFlashTimer);
      generateFlashTimer = null;
    }
    btnAdd.textContent = "Generated!";
    generateFlashTimer = window.setTimeout(function () {
      btnAdd.textContent = btnAddDefaultLabel;
      generateFlashTimer = null;
    }, 1500);
  }

  function sanitizeFilename(name) {
    if (!name || !String(name).trim()) {
      return "item";
    }
    let s = String(name).trim();
    s = s.replace(/[<>:"/\\|?*]/g, "_").replace(/^[\s.]+|[\s.]+$/g, "");
    return s || "item";
  }

  function showQrFromBase64(b64, itemName) {
    currentQrBase64 = b64;
    currentItemNameForFile = sanitizeFilename(itemName || "item");
    const dataUrl = "data:image/png;base64," + b64;
    qrImage.src = dataUrl;
    qrImage.hidden = false;
    qrPlaceholder.hidden = true;
    printQr.src = dataUrl;
    btnDownloadPng.disabled = false;
    btnPrint.disabled = false;
  }

  function clearQrDisplay() {
    currentQrBase64 = null;
    qrImage.removeAttribute("src");
    qrImage.hidden = true;
    qrPlaceholder.hidden = false;
    printQr.removeAttribute("src");
    btnDownloadPng.disabled = true;
    btnPrint.disabled = true;
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/history", { method: "GET" });
      const data = await res.json();
      if (!data.success) {
        return;
      }
      renderTable(data.records || []);
    } catch (err) {
      console.error(err);
    }
  }

  function renderTable(records) {
    historyTbody.textContent = "";

    records.forEach(function (rec) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        escapeHtml(String(rec.id)) +
        "</td>" +
        "<td>" +
        escapeHtml(rec.item_name || "") +
        "</td>" +
        "<td>" +
        escapeHtml(rec.full_name || "") +
        "</td>" +
        "<td>" +
        escapeHtml(rec.phone || "") +
        "</td>" +
        "<td>" +
        escapeHtml(String(rec.created_at || "")) +
        "</td>" +
        '<td><button type="button" class="btn btn-danger" data-id="' +
        escapeHtml(String(rec.id)) +
        '">Delete</button></td>';
      historyTbody.appendChild(tr);
    });

    historyTbody.querySelectorAll("button[data-id]").forEach(function (btn) {
      btn.addEventListener("click", onDeleteClick);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function onDeleteClick(ev) {
    const id = ev.currentTarget.getAttribute("data-id");
    if (!id) {
      return;
    }
    if (!window.confirm("Delete this record?")) {
      return;
    }
    try {
      const res = await fetch("/api/delete/" + encodeURIComponent(id), {
        method: "DELETE",
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.success) {
        window.alert("Delete failed.");
        return;
      }
      await loadHistory();
    } catch (err) {
      console.error(err);
      window.alert("Delete failed.");
    }
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    setFormMessage("");

    const payload = {
      item_name: itemNameInput.value.trim(),
      full_name: fullNameInput.value.trim(),
      address: addressInput.value.trim(),
      phone: phoneInput.value.trim(),
    };

    btnAdd.disabled = true;
    let addSucceeded = false;

    try {
      const res = await fetch("/api/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok || !data.success) {
        setFormMessage(data.error || "Request failed.", "error");
        return;
      }

      addSucceeded = true;
      showQrFromBase64(data.qr_base64, data.item_name || payload.item_name);
      setFormMessage("Record saved and QR updated.", "ok");
      clearFormInputs();
      await loadHistory();
    } catch (err) {
      console.error(err);
      setFormMessage("Network error.", "error");
    } finally {
      btnAdd.disabled = false;
      if (addSucceeded) {
        flashGenerateButton();
      }
    }
  });

  btnDownloadPng.addEventListener("click", function () {
    if (!currentQrBase64) {
      window.alert("Generate a QR code first.");
      return;
    }
    const link = document.createElement("a");
    link.href = "data:image/png;base64," + currentQrBase64;
    link.download = currentItemNameForFile + "_QR.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  btnPrint.addEventListener("click", function () {
    if (!currentQrBase64) {
      window.alert("Generate a QR code first.");
      return;
    }
    const url = "data:image/png;base64," + currentQrBase64;
    printQr.onload = function () {
      printQr.onload = null;
      printQr.onerror = null;
      window.print();
    };
    printQr.onerror = function () {
      printQr.onerror = null;
      printQr.onload = null;
      window.alert("Could not prepare the image for printing.");
    };
    printQr.src = url;
  });

  btnExportJson.addEventListener("click", function () {
    window.location.href = "/api/export";
  });

  clearQrDisplay();
  loadHistory();
})();
