(function () {
  "use strict";

  var STORAGE_LANG = "lfqr_lang";
  var STORAGE_THEME = "lfqr_theme";

  var I18N = {
    RU: {
      "doc.title": "Lost & Found — генератор QR",
      "app.title": "Lost & Found — генератор QR",
      "app.subtitle":
        "Безопасная метка: внутри только название предмета и телефон. Полные данные хранятся в истории.",
      "settings.theme": "Тема",
      "settings.language": "Язык",
      "settings.aria": "Настройки отображения",
      "theme.system": "Системная",
      "theme.dark": "Темная",
      "theme.light": "Светлая",
      "card.formTitle": "Данные о вещи",
      "card.previewTitle": "Предпросмотр и история",
      "field.itemName": "Название предмета",
      "field.fullName": "ФИО",
      "field.address": "Адрес",
      "field.phone": "Телефон",
      "ph.itemName": "Название предмета",
      "ph.fullName": "ФИО",
      "ph.address": "Адрес",
      "ph.phone": "Телефон",
      "btn.generate": "Сгенерировать QR-код",
      "btn.exportJson": "Экспорт истории в JSON",
      "btn.savePng": "Сохранить QR как PNG",
      "btn.print": "Печать QR-кода",
      "btn.generated": "Готово!",
      "preview.srTitle": "Предпросмотр QR-кода",
      "qr.placeholder": "Предпросмотр QR",
      "history.title": "История",
      "th.id": "ID",
      "th.item": "Предмет",
      "th.name": "Имя",
      "th.phone": "Телефон",
      "th.date": "Дата",
      "th.action": "Действие",
      "tbl.delete": "Удалить",
      "alt.qr": "Сгенерированный QR-код",
      "alt.qrPrint": "QR-код для печати",
      "msg.recordSaved": "Запись сохранена, QR обновлён.",
      "msg.requestFailed": "Ошибка запроса.",
      "msg.networkError": "Ошибка сети.",
      "alert.noQr": "Сначала сгенерируйте QR-код.",
      "alert.deleteFailed": "Не удалось удалить.",
      "alert.printPrepFailed": "Не удалось подготовить изображение для печати.",
      "confirm.delete": "Удалить эту запись?",
    },
    EN: {
      "doc.title": "Lost & Found QR Generator",
      "app.title": "Lost & Found QR Generator",
      "app.subtitle":
        "Secure tag: contains only the item name and phone. Full details are stored in history.",
      "settings.theme": "Theme",
      "settings.language": "Language",
      "settings.aria": "Display settings",
      "theme.system": "System",
      "theme.dark": "Dark",
      "theme.light": "Light",
      "card.formTitle": "Item details",
      "card.previewTitle": "Preview & history",
      "field.itemName": "Item name",
      "field.fullName": "Full name",
      "field.address": "Address",
      "field.phone": "Phone",
      "ph.itemName": "Item name",
      "ph.fullName": "Full name",
      "ph.address": "Address",
      "ph.phone": "Phone",
      "btn.generate": "Generate QR Code",
      "btn.exportJson": "Export History to JSON",
      "btn.savePng": "Save QR to PNG",
      "btn.print": "Print QR Code",
      "btn.generated": "Generated!",
      "preview.srTitle": "QR code preview",
      "qr.placeholder": "QR preview",
      "history.title": "History",
      "th.id": "ID",
      "th.item": "Item",
      "th.name": "Name",
      "th.phone": "Phone",
      "th.date": "Date",
      "th.action": "Action",
      "tbl.delete": "Delete",
      "alt.qr": "Generated QR code",
      "alt.qrPrint": "QR code for printing",
      "msg.recordSaved": "Record saved and QR updated.",
      "msg.requestFailed": "Request failed.",
      "msg.networkError": "Network error.",
      "alert.noQr": "Generate a QR code first.",
      "alert.deleteFailed": "Delete failed.",
      "alert.printPrepFailed": "Could not prepare the image for printing.",
      "confirm.delete": "Delete this record?",
    },
  };

  var form = document.getElementById("record-form");
  var itemNameInput = document.getElementById("item_name");
  var fullNameInput = document.getElementById("full_name");
  var addressInput = document.getElementById("address");
  var phoneInput = document.getElementById("phone");
  var formMessage = document.getElementById("form-message");
  var btnAdd = document.getElementById("btn-add");
  var qrImage = document.getElementById("qr-image");
  var qrPlaceholder = document.getElementById("qr-placeholder");
  var btnDownloadPng = document.getElementById("btn-download-png");
  var btnPrint = document.getElementById("btn-print");
  var btnExportJson = document.getElementById("btn-export-json");
  var historyTbody = document.getElementById("history-tbody");
  var printQr = document.getElementById("print-qr");
  var themeSelect = document.getElementById("theme-select");
  var langSelect = document.getElementById("lang-select");
  var settingsBar = document.querySelector(".settings-bar");

  var currentLang = "RU";
  var btnAddDefaultLabel = "";
  var currentQrBase64 = null;
  var currentItemNameForFile = "item";
  var generateFlashTimer = null;
  var systemThemeMq = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredLang() {
    var v = window.localStorage.getItem(STORAGE_LANG);
    if (v === "en" || v === "EN") {
      return "EN";
    }
    if (v === "ru" || v === "RU") {
      return "RU";
    }
    return "RU";
  }

  function setStoredLang(lang) {
    window.localStorage.setItem(STORAGE_LANG, lang === "EN" ? "en" : "ru");
  }

  function getStoredTheme() {
    var v = window.localStorage.getItem(STORAGE_THEME);
    if (v === "dark" || v === "light" || v === "system") {
      return v;
    }
    return "system";
  }

  function setStoredTheme(theme) {
    window.localStorage.setItem(STORAGE_THEME, theme);
  }

  function resolveTheme(pref) {
    if (pref === "dark") {
      return "dark";
    }
    if (pref === "light") {
      return "light";
    }
    return systemThemeMq.matches ? "dark" : "light";
  }

  function applyResolvedTheme() {
    var resolved = resolveTheme(getStoredTheme());
    document.documentElement.setAttribute("data-theme", resolved);
  }

  function t(key) {
    var pack = I18N[currentLang] || I18N.RU;
    if (Object.prototype.hasOwnProperty.call(pack, key)) {
      return pack[key];
    }
    return I18N.RU[key] || key;
  }

  function applyI18n() {
    document.documentElement.lang = currentLang === "RU" ? "ru" : "en";

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!key) {
        return;
      }
      var val = t(key);
      if (el.tagName === "TITLE") {
        document.title = val;
      } else {
        el.textContent = val;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (key) {
        el.setAttribute("placeholder", t(key));
      }
    });

    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-alt");
      if (key) {
        el.setAttribute("alt", t(key));
      }
    });

    if (settingsBar) {
      settingsBar.setAttribute("aria-label", t("settings.aria"));
    }

    refreshGenerateButtonLabel();
  }

  function refreshGenerateButtonLabel() {
    btnAddDefaultLabel = t("btn.generate");
    if (generateFlashTimer === null) {
      btnAdd.textContent = btnAddDefaultLabel;
    }
  }

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
    btnAdd.textContent = t("btn.generated");
    generateFlashTimer = window.setTimeout(function () {
      btnAdd.textContent = btnAddDefaultLabel;
      generateFlashTimer = null;
    }, 1500);
  }

  function sanitizeFilename(name) {
    if (!name || !String(name).trim()) {
      return "item";
    }
    var s = String(name).trim();
    s = s.replace(/[<>:"/\\|?*]/g, "_").replace(/^[\s.]+|[\s.]+$/g, "");
    return s || "item";
  }

  function showQrFromBase64(b64, itemName) {
    currentQrBase64 = b64;
    currentItemNameForFile = sanitizeFilename(itemName || "item");
    var dataUrl = "data:image/png;base64," + b64;
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
      var res = await fetch("/api/history", { method: "GET" });
      var data = await res.json();
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
    var delLabel = t("tbl.delete");

    records.forEach(function (rec) {
      var tr = document.createElement("tr");
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
        '">' +
        escapeHtml(delLabel) +
        "</button></td>";
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
    var id = ev.currentTarget.getAttribute("data-id");
    if (!id) {
      return;
    }
    if (!window.confirm(t("confirm.delete"))) {
      return;
    }
    try {
      var res = await fetch("/api/delete/" + encodeURIComponent(id), {
        method: "DELETE",
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.success) {
        window.alert(t("alert.deleteFailed"));
        return;
      }
      await loadHistory();
    } catch (err) {
      console.error(err);
      window.alert(t("alert.deleteFailed"));
    }
  }

  form.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    setFormMessage("");

    var payload = {
      item_name: itemNameInput.value.trim(),
      full_name: fullNameInput.value.trim(),
      address: addressInput.value.trim(),
      phone: phoneInput.value.trim(),
    };

    btnAdd.disabled = true;
    var addSucceeded = false;

    try {
      var res = await fetch("/api/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var data = await res.json().catch(function () {
        return {};
      });

      if (!res.ok || !data.success) {
        setFormMessage(data.error || t("msg.requestFailed"), "error");
        return;
      }

      addSucceeded = true;
      showQrFromBase64(data.qr_base64, data.item_name || payload.item_name);
      setFormMessage(t("msg.recordSaved"), "ok");
      clearFormInputs();
      await loadHistory();
    } catch (err) {
      console.error(err);
      setFormMessage(t("msg.networkError"), "error");
    } finally {
      btnAdd.disabled = false;
      if (addSucceeded) {
        flashGenerateButton();
      }
    }
  });

  btnDownloadPng.addEventListener("click", function () {
    if (!currentQrBase64) {
      window.alert(t("alert.noQr"));
      return;
    }
    var link = document.createElement("a");
    link.href = "data:image/png;base64," + currentQrBase64;
    link.download = currentItemNameForFile + "_QR.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  btnPrint.addEventListener("click", function () {
    if (!currentQrBase64) {
      window.alert(t("alert.noQr"));
      return;
    }
    var url = "data:image/png;base64," + currentQrBase64;
    printQr.onload = function () {
      printQr.onload = null;
      printQr.onerror = null;
      window.print();
    };
    printQr.onerror = function () {
      printQr.onerror = null;
      printQr.onload = null;
      window.alert(t("alert.printPrepFailed"));
    };
    printQr.src = url;
  });

  btnExportJson.addEventListener("click", function () {
    window.location.href = "/api/export";
  });

  function onSystemThemeChange() {
    if (getStoredTheme() === "system") {
      applyResolvedTheme();
    }
  }

  function initThemeControls() {
    applyResolvedTheme();
    themeSelect.addEventListener("change", function () {
      setStoredTheme(themeSelect.value);
      applyResolvedTheme();
    });
    if (typeof systemThemeMq.addEventListener === "function") {
      systemThemeMq.addEventListener("change", onSystemThemeChange);
    } else if (typeof systemThemeMq.addListener === "function") {
      systemThemeMq.addListener(onSystemThemeChange);
    }
  }

  function initLangControls() {
    langSelect.addEventListener("change", function () {
      currentLang = langSelect.value === "en" ? "EN" : "RU";
      setStoredLang(currentLang);
      applyI18n();
      loadHistory();
    });
  }

  currentLang = getStoredLang();
  themeSelect.value = getStoredTheme();
  langSelect.value = currentLang === "RU" ? "ru" : "en";
  applyI18n();
  initThemeControls();
  initLangControls();

  clearQrDisplay();
  loadHistory();
})();
