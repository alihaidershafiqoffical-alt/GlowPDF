"""
Glow PDF Engine Registry
Centralized capability discovery, dependency auditing, and multi-tier engine orchestration.
"""
import os
import shutil
import subprocess
import sys
from typing import Dict, Any, Optional

def find_binary(names: list, candidate_paths: list = None) -> Optional[str]:
    """Find system executable in PATH or standard OS locations."""
    for name in names:
        p = shutil.which(name)
        if p:
            return p
    if candidate_paths:
        for c in candidate_paths:
            if os.path.exists(c):
                return c
    return None

def detect_libreoffice() -> Optional[str]:
    return find_binary(
        ["soffice", "soffice.exe", "libreoffice"],
        [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            r"/usr/bin/libreoffice",
            r"/usr/bin/soffice",
            r"/Applications/LibreOffice.app/Contents/MacOS/soffice"
        ]
    )

def detect_chromium() -> Optional[str]:
    return find_binary(
        ["chromium", "google-chrome", "chrome", "msedge", "edge", "brave"],
        [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"/usr/bin/chromium",
            r"/usr/bin/chromium-browser",
            r"/usr/bin/google-chrome",
            r"/usr/bin/google-chrome-stable",
            r"/snap/bin/chromium",
            r"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            r"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        ]
    )

def detect_ghostscript() -> Optional[str]:
    return find_binary(
        ["gs", "gswin64c", "gswin32c"],
        [
            r"C:\Program Files\gs\gs*\bin\gswin64c.exe",
            r"C:\Program Files (x86)\gs\gs*\bin\gswin32c.exe",
            r"/usr/bin/gs",
            r"/usr/local/bin/gs"
        ]
    )

def detect_qpdf() -> Optional[str]:
    return find_binary(
        ["qpdf", "qpdf.exe"],
        [
            r"C:\Program Files\qpdf\bin\qpdf.exe",
            r"/usr/bin/qpdf",
            r"/usr/local/bin/qpdf"
        ]
    )

def detect_tesseract() -> Optional[str]:
    return find_binary(
        ["tesseract", "tesseract.exe"],
        [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            r"/usr/bin/tesseract",
            r"/usr/local/bin/tesseract"
        ]
    )

def get_engine_registry() -> Dict[str, Any]:
    """Return comprehensive inventory of all available engines and capabilities."""
    engines = {}

    # 1. LibreOffice
    lo_bin = detect_libreoffice()
    engines["libreoffice"] = {
        "installed": lo_bin is not None,
        "path": lo_bin,
        "role": "Primary High-Fidelity Office to PDF (Word, Excel, PowerPoint)",
        "license": "MPL-2.0 (Open Source)",
        "commercial_use": True
    }

    # 2. Chromium / Headless Browser
    chrom_bin = detect_chromium()
    engines["chromium"] = {
        "installed": chrom_bin is not None,
        "path": chrom_bin,
        "role": "HTML to PDF & URL to PDF rendering",
        "license": "BSD-3-Clause (Open Source)",
        "commercial_use": True
    }

    # 3. Ghostscript
    gs_bin = detect_ghostscript()
    engines["ghostscript"] = {
        "installed": gs_bin is not None,
        "path": gs_bin,
        "role": "Extreme/High PDF Compression & PDF/A compliance",
        "license": "AGPLv3 / Commercial",
        "commercial_use": True
    }

    # 4. QPDF
    qpdf_bin = detect_qpdf()
    engines["qpdf"] = {
        "installed": qpdf_bin is not None,
        "path": qpdf_bin,
        "role": "PDF Structural Repair & Linearization",
        "license": "Apache-2.0 (Open Source)",
        "commercial_use": True
    }

    # 5. Tesseract
    tess_bin = detect_tesseract()
    engines["tesseract"] = {
        "installed": tess_bin is not None,
        "path": tess_bin,
        "role": "Optical Character Recognition (OCR)",
        "license": "Apache-2.0 (Open Source)",
        "commercial_use": True
    }

    # 6. Python in-process libraries
    try:
        import pymupdf
        pymupdf_ver = getattr(pymupdf, "__version__", "installed")
    except ImportError:
        pymupdf_ver = None

    try:
        import pdf2docx
        pdf2docx_ver = getattr(pdf2docx, "__version__", "installed")
    except ImportError:
        pdf2docx_ver = None

    try:
        import pypdf
        pypdf_ver = getattr(pypdf, "__version__", "installed")
    except ImportError:
        pypdf_ver = None

    try:
        import pyhanko
        pyhanko_ver = "installed"
    except ImportError:
        pyhanko_ver = None

    try:
        import pdfplumber
        pdfplumber_ver = getattr(pdfplumber, "__version__", "installed")
    except ImportError:
        pdfplumber_ver = None

    try:
        import xlsxwriter
        xlsxwriter_ver = getattr(xlsxwriter, "__version__", "installed")
    except ImportError:
        xlsxwriter_ver = None

    try:
        import openpyxl
        openpyxl_ver = getattr(openpyxl, "__version__", "installed")
    except ImportError:
        openpyxl_ver = None

    try:
        import pptx
        pptx_ver = getattr(pptx, "__version__", "installed")
    except ImportError:
        pptx_ver = None

    engines["pymupdf"] = {
        "installed": pymupdf_ver is not None,
        "version": pymupdf_ver,
        "role": "PDF analysis, text/vector extraction, Story fallback rendering, Redaction",
        "license": "AGPLv3",
        "commercial_use": True
    }
    engines["pdf2docx"] = {
        "installed": pdf2docx_ver is not None,
        "version": pdf2docx_ver,
        "role": "PDF to Word Layout Reconstruction",
        "license": "GPLv3",
        "commercial_use": True
    }
    engines["pypdf"] = {
        "installed": pypdf_ver is not None,
        "version": pypdf_ver,
        "role": "PDF Form Filling & Metadata",
        "license": "BSD-3-Clause",
        "commercial_use": True
    }
    engines["pyhanko"] = {
        "installed": pyhanko_ver is not None,
        "version": pyhanko_ver,
        "role": "Cryptographic PKI Digital Signatures",
        "license": "MIT",
        "commercial_use": True
    }
    engines["pdfplumber"] = {
        "installed": pdfplumber_ver is not None,
        "version": pdfplumber_ver,
        "role": "PDF Table and Cell Extraction",
        "license": "MIT",
        "commercial_use": True
    }
    engines["xlsxwriter"] = {
        "installed": xlsxwriter_ver is not None,
        "version": xlsxwriter_ver,
        "role": "Excel Spreadsheet Generation",
        "license": "BSD-2-Clause",
        "commercial_use": True
    }
    engines["openpyxl"] = {
        "installed": openpyxl_ver is not None,
        "version": openpyxl_ver,
        "role": "Excel Spreadsheet Parsing and Vector Grid Fallback",
        "license": "MIT",
        "commercial_use": True
    }
    engines["python-pptx"] = {
        "installed": pptx_ver is not None,
        "version": pptx_ver,
        "role": "PowerPoint Presentation Generation and Fallback Parsing",
        "license": "MIT",
        "commercial_use": True
    }

    return engines
