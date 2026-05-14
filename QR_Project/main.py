import re
import sys
import sqlite3
import datetime
import json
import os
import io

from PyQt6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QHBoxLayout,
    QVBoxLayout,
    QLineEdit,
    QPushButton,
    QLabel,
    QTableWidget,
    QTableWidgetItem,
    QFileDialog,
    QMessageBox,
    QHeaderView,
    QMenu,
    QFrame,
    QGraphicsDropShadowEffect,
    QDialog,
)
from PyQt6.QtCore import QRect, Qt
from PyQt6.QtGui import QPixmap, QImage, QAction, QColor, QPainter

from PyQt6.QtPrintSupport import QPrinter, QPrintDialog

import qrcode
from PIL import Image


APP_STYLESHEET = """
QWidget {
    background-color: #1e1e2e;
    color: #e0e0e0;
    font-size: 13px;
}

QMainWindow {
    background-color: #1e1e2e;
}

QFrame#leftCard, QFrame#rightCard {
    background-color: #2b2b36;
    border-radius: 20px;
    border: none;
}

QLabel {
    color: #e0e0e0;
    background-color: transparent;
}

QLabel#qrPreviewLabel {
    background-color: #252536;
    border-radius: 16px;
    border: 1px solid #3b3b4f;
    color: #9090a8;
}

QLineEdit {
    background-color: #3b3b4f;
    border-radius: 12px;
    padding: 10px;
    border: 2px solid transparent;
    color: #e0e0e0;
    selection-background-color: #5865F2;
    selection-color: #ffffff;
}

QLineEdit:focus {
    border: 2px solid #7289da;
}

QPushButton#btnGenerate,
QPushButton#btnExport,
QPushButton#btnSavePng,
QPushButton#btnPrintQr {
    background-color: #5865F2;
    color: #ffffff;
    border: none;
    border-radius: 20px;
    padding: 12px 18px;
    font-weight: 600;
    min-height: 20px;
}

QPushButton#btnGenerate:hover,
QPushButton#btnExport:hover,
QPushButton#btnSavePng:hover,
QPushButton#btnPrintQr:hover {
    background-color: #6875f5;
}

QPushButton#btnGenerate:pressed,
QPushButton#btnExport:pressed,
QPushButton#btnSavePng:pressed,
QPushButton#btnPrintQr:pressed {
    background-color: #4752c4;
}

QPushButton#btnGenerate:disabled,
QPushButton#btnExport:disabled,
QPushButton#btnSavePng:disabled,
QPushButton#btnPrintQr:disabled {
    background-color: #3c3f5c;
    color: #9090a8;
}

QTableWidget, QAbstractItemView {
    outline: none;
}

QTableWidget {
    background-color: #252536;
    alternate-background-color: #2a2a3e;
    color: #e0e0e0;
    gridline-color: transparent;
    border: none;
    border-radius: 12px;
    selection-background-color: transparent;
}

QTableWidget:focus {
    outline: none;
}

QTableWidget::item {
    padding: 8px;
    border: none;
    outline: none;
}

QTableWidget::item:selected {
    background-color: #3d4470;
    color: #f0f0f5;
}

QTableWidget::item:focus {
    outline: none;
    border: none;
}

QHeaderView::section {
    background-color: #32324a;
    color: #e0e0e0;
    font-weight: bold;
    padding: 10px 8px;
    border: none;
    border-bottom: 2px solid #3b3b4f;
}

QScrollBar:vertical {
    background: #252536;
    width: 10px;
    margin: 0;
    border-radius: 5px;
}

QScrollBar::handle:vertical {
    background: #4a4a64;
    min-height: 24px;
    border-radius: 5px;
}

QScrollBar::handle:vertical:hover {
    background: #5865F2;
}

QScrollBar:horizontal {
    background: #252536;
    height: 10px;
    margin: 0;
}

QScrollBar::handle:horizontal {
    background: #4a4a64;
    min-width: 24px;
    border-radius: 5px;
}

QMenu {
    background-color: #2b2b36;
    color: #e0e0e0;
    border: 1px solid #3b3b4f;
    border-radius: 10px;
    padding: 6px;
}

QMenu::item {
    padding: 10px 28px;
    border-radius: 8px;
}

QMenu::item:selected {
    background-color: #5865F2;
}

QMessageBox {
    background-color: #2b2b36;
}

QMessageBox QLabel {
    color: #e0e0e0;
}

QMessageBox QPushButton {
    background-color: #5865F2;
    color: #ffffff;
    border-radius: 12px;
    padding: 8px 20px;
    min-width: 72px;
    border: none;
}

QMessageBox QPushButton:hover {
    background-color: #6875f5;
}

QMessageBox QPushButton:pressed {
    background-color: #4752c4;
}
"""


def _card_shadow(widget):
    effect = QGraphicsDropShadowEffect(widget)
    effect.setBlurRadius(20)
    effect.setColor(QColor(0, 0, 0, 220))
    effect.setOffset(0, 5)
    widget.setGraphicsEffect(effect)
    return effect


def _sanitize_filename_component(name):
    """Remove characters invalid in Windows file names."""
    if not name or not str(name).strip():
        return "item"
    s = str(name).strip()
    s = re.sub(r'[<>:"/\\|?*]', "_", s)
    s = s.strip(" .")
    return s or "item"


class DatabaseManager:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db")
        self.db_path = db_path
        self._ensure_table()

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def _ensure_table(self):
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY,
                    item_name TEXT,
                    full_name TEXT,
                    address TEXT,
                    phone TEXT,
                    created_at TIMESTAMP
                )
                """
            )

    def add_record(self, item_name, full_name, address, phone):
        created_at = datetime.datetime.now().isoformat(sep=" ", timespec="seconds")
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO users (item_name, full_name, address, phone, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (item_name, full_name, address, phone, created_at),
            )

    def get_all_records(self):
        with self._connect() as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute(
                """
                SELECT id, item_name, full_name, address, phone, created_at
                FROM users
                ORDER BY id DESC
                """
            )
            return [dict(row) for row in cur.fetchall()]

    def delete_record(self, record_id):
        with self._connect() as conn:
            conn.execute("DELETE FROM users WHERE id = ?", (record_id,))


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("QR Code Generator v1.0")
        self.setMinimumSize(1000, 700)

        self.db = DatabaseManager()
        self._current_qr_pixmap = None

        central = QWidget()
        self.setCentralWidget(central)

        main_layout = QHBoxLayout(central)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(24)

        # --- Left card: input form ---
        left_card = QFrame()
        left_card.setObjectName("leftCard")
        _card_shadow(left_card)
        left_inner = QVBoxLayout(left_card)
        left_inner.setContentsMargins(24, 24, 24, 24)
        left_inner.setSpacing(10)

        self.edit_item = QLineEdit()
        self.edit_item.setPlaceholderText("Item Name")
        self.edit_full = QLineEdit()
        self.edit_full.setPlaceholderText("Full Name")
        self.edit_address = QLineEdit()
        self.edit_address.setPlaceholderText("Address")
        self.edit_phone = QLineEdit()
        self.edit_phone.setPlaceholderText("Phone")

        left_inner.addWidget(QLabel("Item Name"))
        left_inner.addWidget(self.edit_item)
        left_inner.addWidget(QLabel("Full Name"))
        left_inner.addWidget(self.edit_full)
        left_inner.addWidget(QLabel("Address"))
        left_inner.addWidget(self.edit_address)
        left_inner.addWidget(QLabel("Phone"))
        left_inner.addWidget(self.edit_phone)

        btn_generate = QPushButton("Generate QR Code")
        btn_generate.setObjectName("btnGenerate")
        btn_generate.clicked.connect(self.on_generate_qr)
        left_inner.addWidget(btn_generate)

        btn_export = QPushButton("Export History to JSON")
        btn_export.setObjectName("btnExport")
        btn_export.clicked.connect(self.on_export_json)
        left_inner.addWidget(btn_export)

        left_inner.addStretch()

        # --- Right card: preview & history ---
        right_card = QFrame()
        right_card.setObjectName("rightCard")
        _card_shadow(right_card)
        right_inner = QVBoxLayout(right_card)
        right_inner.setContentsMargins(24, 24, 24, 24)
        right_inner.setSpacing(16)

        self.qr_label = QLabel()
        self.qr_label.setObjectName("qrPreviewLabel")
        self.qr_label.setFixedSize(250, 250)
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.qr_label.setFrameShape(QLabel.Shape.NoFrame)
        self.qr_label.setText("QR preview")
        right_inner.addWidget(self.qr_label, alignment=Qt.AlignmentFlag.AlignHCenter)

        png_print_row = QHBoxLayout()
        png_print_row.setSpacing(12)
        png_print_row.addStretch(1)

        btn_save_png = QPushButton("Save QR to PNG")
        btn_save_png.setObjectName("btnSavePng")
        btn_save_png.clicked.connect(self.on_save_qr_png)
        png_print_row.addWidget(btn_save_png)

        btn_print_qr = QPushButton("Print QR Code")
        btn_print_qr.setObjectName("btnPrintQr")
        btn_print_qr.clicked.connect(self.print_qr)
        png_print_row.addWidget(btn_print_qr)

        png_print_row.addStretch(1)
        right_inner.addLayout(png_print_row)

        self.table = QTableWidget(0, 5)
        self.table.setAlternatingRowColors(True)
        self.table.setHorizontalHeaderLabels(["ID", "Item", "Name", "Phone", "Date"])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self.on_table_context_menu)
        self.table.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.table.setShowGrid(False)
        right_inner.addWidget(self.table)

        main_layout.addWidget(left_card, stretch=1)
        main_layout.addWidget(right_card, stretch=2)

        self.refresh_table()

    def _payload_from_form(self):
        return {
            "item_name": self.edit_item.text().strip(),
            "full_name": self.edit_full.text().strip(),
            "address": self.edit_address.text().strip(),
            "phone": self.edit_phone.text().strip(),
        }

    def _build_secure_qr_payload(self, item_name, phone):
        return (
            "ВНИМАНИЕ! Найден предмет: {item_name}. "
            "Пожалуйста, свяжитесь по телефону: {phone} для возврата."
        ).format(item_name=item_name, phone=phone)

    def on_generate_qr(self):
        data = self._payload_from_form()
        if not data["item_name"] or not data["phone"]:
            QMessageBox.warning(
                self,
                "Missing data",
                "Item name and phone are required to generate the QR code.",
            )
            return

        payload_text = self._build_secure_qr_payload(data["item_name"], data["phone"])
        img = qrcode.make(payload_text)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        qimage = QImage.fromData(buffer.read())
        if qimage.isNull():
            QMessageBox.critical(self, "Error", "Could not build QR image.")
            return

        pixmap = QPixmap.fromImage(qimage).scaled(
            250,
            250,
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation,
        )
        self._current_qr_pixmap = pixmap
        self.qr_label.setPixmap(pixmap)
        self.qr_label.setText("")

        self.db.add_record(
            data["item_name"],
            data["full_name"],
            data["address"],
            data["phone"],
        )
        self.refresh_table()

    def print_qr(self):
        if self._current_qr_pixmap is None or self._current_qr_pixmap.isNull():
            QMessageBox.warning(
                self,
                "No QR",
                "Generate a QR code before printing.",
            )
            return

        printer = QPrinter(QPrinter.PrinterMode.HighResolution)
        dialog = QPrintDialog(printer, self)

        if dialog.exec() != QDialog.DialogCode.Accepted:
            return

        pixmap = self._current_qr_pixmap
        painter = QPainter(printer)
        page = printer.pageRect(QPrinter.Unit.DevicePixel)
        pw = page.width()
        ph = page.height()

        scale = min(0.62 * pw / max(pixmap.width(), 1), 0.55 * ph / max(pixmap.height(), 1))
        draw_w = int(pixmap.width() * scale)
        draw_h = int(pixmap.height() * scale)

        margin_top = int(max(48, min(ph, pw) * 0.06))
        x = page.x() + (pw - draw_w) // 2
        y = page.y() + margin_top

        target = QRect(x, y, draw_w, draw_h)
        painter.drawPixmap(target, pixmap, pixmap.rect())
        painter.end()

    def on_save_qr_png(self):
        if self._current_qr_pixmap is None or self._current_qr_pixmap.isNull():
            QMessageBox.warning(self, "No QR", "Generate a QR code before saving.")
            return

        item_part = _sanitize_filename_component(self.edit_item.text().strip())
        default_name = f"{item_part}_QR.png"
        default_path = os.path.join(os.path.expanduser("~"), default_name)

        path, _ = QFileDialog.getSaveFileName(
            self,
            "Save QR as PNG",
            default_path,
            "PNG Images (*.png);;All Files (*)",
        )
        if not path:
            return

        if not path.lower().endswith(".png"):
            path += ".png"

        if not self._current_qr_pixmap.save(path, "PNG"):
            QMessageBox.critical(self, "Save failed", "Could not save the QR image.")
            return

        QMessageBox.information(self, "Saved", f"QR saved to:\n{path}")

    def on_export_json(self):
        records = self.db.get_all_records()
        path, _ = QFileDialog.getSaveFileName(
            self,
            "Export history",
            os.path.join(os.path.expanduser("~"), "qr_history_export.json"),
            "JSON Files (*.json);;All Files (*)",
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
        except OSError as e:
            QMessageBox.critical(self, "Export failed", str(e))
            return
        QMessageBox.information(self, "Exported", f"Saved {len(records)} record(s) to:\n{path}")

    def on_table_context_menu(self, pos):
        row = self.table.rowAt(pos.y())
        if row < 0:
            return

        menu = QMenu(self)
        act_delete = QAction("Delete Record", self)
        act_delete.triggered.connect(lambda checked=False, r=row: self.delete_table_row(r))
        menu.addAction(act_delete)
        menu.exec(self.table.viewport().mapToGlobal(pos))

    def delete_table_row(self, row):
        id_item = self.table.item(row, 0)
        if id_item is None:
            return
        try:
            record_id = int(id_item.text())
        except ValueError:
            return
        self.db.delete_record(record_id)
        self.refresh_table()

    def refresh_table(self):
        records = self.db.get_all_records()
        self.table.setRowCount(len(records))
        for row, rec in enumerate(records):
            self.table.setItem(row, 0, QTableWidgetItem(str(rec["id"])))
            self.table.setItem(row, 1, QTableWidgetItem(rec["item_name"] or ""))
            self.table.setItem(row, 2, QTableWidgetItem(rec["full_name"] or ""))
            self.table.setItem(row, 3, QTableWidgetItem(rec["phone"] or ""))
            created = rec["created_at"] or ""
            self.table.setItem(row, 4, QTableWidgetItem(str(created)))


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(APP_STYLESHEET)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
