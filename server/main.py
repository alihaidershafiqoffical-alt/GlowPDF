import os
import sys

# Ensure workspace root is always in sys.path so 'from server...' imports work in all execution modes
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import tempfile
import asyncio
import subprocess
import pathlib
import time
import json
from collections import defaultdict
import threading
from typing import Optional, List, Tuple, Union
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import pymupdf
from pdf2docx import Converter
import html
import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
import io
from pptx import Presentation
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
import re
from itertools import groupby
import pdfplumber
import xlsxwriter
import socket
import urllib.parse
import ipaddress

from server.engine_registry import detect_chromium, get_engine_registry
from server.conversion_engines import (
    convert_excel_to_pdf_multitier,
    convert_pptx_to_pdf_multitier,
    convert_word_to_pdf_multitier,
    docx_to_pdf_convert,
    convert_pdf_to_pdfa,
    compress_pdf_multitier,
    repair_pdf_multitier,
    ocr_pdf_multitier,
    add_page_numbers_to_pdf,
    redact_pdf_content,
    inspect_pdf_forms,
    fill_pdf_forms,
    sign_pdf_visual_or_cert,
    convert_pdf_to_markdown,
    apply_pdf_edits,
    analyze_pdf_content,
)

# Initialize slowapi Limiter with global default limit (60 requests per minute per IP)
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(
    title="GlowPDF Conversion Engine",
    description="Privacy-first, enterprise-grade PDF & Document Conversion Engine"
)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
def _custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Rate limit exceeded. Please wait a moment before sending additional requests."},
        headers={"Retry-After": "60"}
    )

# ------------------------------------------------------------------------------
# Security, Concurrency, and File Validation Infrastructure
# ------------------------------------------------------------------------------
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB max limit

# Concurrency semaphore for heavy background execution
CONCURRENCY_LIMIT = int(os.environ.get("CONCURRENCY_LIMIT", "3"))
conversion_semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)


def safe_remove_file(file_path: Optional[str]) -> None:
    """Safely delete temporary files, handling Windows file lock delays gracefully."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass


def validate_file_upload(
    content: bytes,
    filename: str,
    expected_ext: Union[str, Tuple[str, ...], List[str]],
    expected_magic: Optional[bytes] = None,
    content_type: Optional[str] = None,
    allowed_mime_types: Optional[List[str]] = None
) -> None:
    """Rigorous file size, extension, MIME type, and magic header validation."""
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty."
        )
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of 50 MB (uploaded {len(content) / (1024*1024):.1f} MB)."
        )

    # Validate file extension
    ext = os.path.splitext(filename)[1].lower()
    if isinstance(expected_ext, (list, tuple)):
        if ext not in expected_ext:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file extension '{ext}'. Allowed extensions: {', '.join(expected_ext)}."
            )
    else:
        if ext != expected_ext:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file extension '{ext}'. Expected extension {expected_ext}."
            )

    # Validate MIME content type if supplied
    if content_type and allowed_mime_types:
        ct_clean = content_type.split(";")[0].strip().lower()
        if ct_clean not in allowed_mime_types and not any(ct_clean.startswith(allowed) for allowed in allowed_mime_types):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid MIME content type: '{content_type}'."
            )

    # Validate magic bytes header signature
    if expected_magic and not content.startswith(expected_magic):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content header does not match expected file signature."
        )


# ------------------------------------------------------------------------------
# CORS Configuration
# Authorized origins allowing requests from production frontend and dev environments
# ------------------------------------------------------------------------------
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_base_origins = [
    "https://glow-pdf-three.vercel.app",
    "https://glow-pdf-three.vercel.app/",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]

_allowed_origins = []
if _raw_origins.strip() == "*":
    _allowed_origins = ["*"]
else:
    if _raw_origins.strip():
        _allowed_origins = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]
    for bo in _base_origins:
        if bo not in _allowed_origins:
            _allowed_origins.append(bo)

_allowed_origins_expanded = []
for o in _allowed_origins:
    _allowed_origins_expanded.append(o)
    if o != "*" and not o.endswith("/"):
        _allowed_origins_expanded.append(o + "/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins_expanded,
    allow_origin_regex=r"https://.*\.vercel\.app/?|http://(localhost|127\.0\.0\.1)(:\d+)?/?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "X-PDFA-Standard",
        "X-Engine",
        "X-Total-Pages",
        "X-Paragraphs",
        "X-Tables",
        "X-Has-Tables",
        "X-Has-Headings",
        "X-Total-Rows",
        "X-Total-Cols",
        "X-Total-Worksheets",
        "X-Total-Cells",
        "X-Total-Slides",
        "X-Images",
        "X-Shapes",
        "X-Slide-Count",
        "X-Scanned-Pages",
        "X-Has-Scanned",
        "X-Original-Size",
        "X-Compressed-Size",
        "X-Percent-Saved",
        "X-Compression-Ratio",
    ],
    max_age=86400,
)


@app.get("/api/health")
@limiter.limit("60/minute")
def health(request: Request):
    return {
        "status": "ok",
        "service": "GlowPDF Conversion Engine",
        "engine": "pdf2docx",
        "detector": "PyMuPDF"
    }


# ==============================================================================
# 1. PDF -> WORD CONVERTER
# ==============================================================================
@app.post("/api/convert-pdf-to-word")
@limiter.limit("15/minute")
async def convert_pdf_to_word(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    # 1. Analyze PDF with PyMuPDF: validate structure, passwords, and detect scanned pages
    total_pages = 0
    scanned_pages_count = 0
    try:
        pdf_doc = pymupdf.open(stream=content, filetype="pdf")
        if pdf_doc.is_encrypted or pdf_doc.needs_pass:
            pdf_doc.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This PDF document is password-protected. Please unlock it using GlowPDF's Unlock tool before converting to Word."
            )
        total_pages = len(pdf_doc)
        if total_pages == 0:
            pdf_doc.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The selected PDF contains no readable pages."
            )

        for page in pdf_doc:
            text = page.get_text().strip()
            images = page.get_images()
            if len(text) < 15 and len(images) > 0:
                scanned_pages_count += 1
        pdf_doc.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not open or parse PDF document: {str(e)}"
        )

    # 2. Temporary storage for conversion only
    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        # 3. Execute pdf2docx under concurrency limit and execution timeout
        async with conversion_semaphore:
            def run_conversion():
                cv = Converter(temp_in_path)
                try:
                    cv.convert(temp_out_path)
                finally:
                    cv.close()

            try:
                await asyncio.wait_for(asyncio.to_thread(run_conversion), timeout=90)
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Conversion timed out. The document may be too large or complex for standard processing."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"pdf2docx conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output Word document could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            docx_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_converted"
        download_name = f"{base_name}.docx"
        has_scanned = scanned_pages_count > 0

        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Pages": str(total_pages),
                "X-Scanned-Pages": str(scanned_pages_count),
                "X-Has-Scanned": "true" if has_scanned else "false",
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages, X-Scanned-Pages, X-Has-Scanned"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


@app.post("/api/convert-word-to-pdf")
@limiter.limit("15/minute")
async def convert_word_to_pdf(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "document.docx"
    content = await file.read()
    validate_file_upload(content, filename, ".docx", b"PK\x03\x04")

    temp_in = tempfile.NamedTemporaryFile(suffix=".docx", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(docx_to_pdf_convert, temp_in_path, temp_out_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Word to PDF conversion timed out. Please verify document complexity or try a smaller file."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Word to PDF conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output PDF could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            pdf_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_converted"
        download_name = f"{base_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Pages": str(meta.get("page_count", 1)),
                "X-Paragraphs": str(meta.get("paragraphs", 0)),
                "X-Tables": str(meta.get("tables", 0)),
                "X-Has-Tables": "true" if meta.get("has_tables") else "false",
                "X-Has-Headings": "true" if meta.get("has_headings") else "false",
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages, X-Paragraphs, X-Tables, X-Has-Tables, X-Has-Headings"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


def find_chromium_browser() -> Optional[str]:
    return detect_chromium()



def prepare_html_with_page_options(
    raw_html: str,
    page_size: str = "a4",
    orientation: str = "portrait",
    margin: str = "normal",
    print_background: bool = True
) -> str:
    size_token = "a4" if page_size.lower() == "a4" else "letter"
    orient_token = "landscape" if orientation.lower() == "landscape" else "portrait"
    
    if margin.lower() == "none":
        margin_css = "0mm"
    elif margin.lower() == "small":
        margin_css = "6mm"
    else:
        margin_css = "15mm"

    bg_css = """
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    """ if print_background else """
        * {
            -webkit-print-color-adjust: economy !important;
            print-color-adjust: economy !important;
        }
    """

    injected_style = f"""
    <style id="glowpdf-print-options">
        @page {{
            size: {size_token} {orient_token};
            margin: {margin_css};
        }}
        {bg_css}
    </style>
    """

    if "<head>" in raw_html:
        return raw_html.replace("<head>", f"<head>{injected_style}", 1)
    elif "<HEAD>" in raw_html:
        return raw_html.replace("<HEAD>", f"<HEAD>{injected_style}", 1)
    elif "<html>" in raw_html:
        return raw_html.replace("<html>", f"<html><head>{injected_style}</head>", 1)
    elif "<HTML>" in raw_html:
        return raw_html.replace("<HTML>", f"<HTML><HEAD>{injected_style}</HEAD>", 1)
    else:
        return f"<!DOCTYPE html><html><head>{injected_style}</head><body>{raw_html}</body></html>"


def html_to_pdf_chromium(
    html_file_path: str,
    pdf_out_path: str,
    browser_exe: str
) -> bool:
    profile_dir = os.path.join(tempfile.gettempdir(), "glowpdf_chromium_cache_profile")
    os.makedirs(profile_dir, exist_ok=True)
    file_uri = pathlib.Path(html_file_path).as_uri()

    cmd = [
        browser_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--disable-translate",
        "--metrics-recording-only",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--mute-audio",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        f"--user-data-dir={profile_dir}",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_out_path}",
        file_uri
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(200):
        time.sleep(0.1)
        if os.path.exists(pdf_out_path) and os.path.getsize(pdf_out_path) > 1000:
            time.sleep(0.15)
            break

    try:
        proc.terminate()
        proc.wait(timeout=2)
    except Exception:
        proc.kill()

    return os.path.exists(pdf_out_path) and os.path.getsize(pdf_out_path) > 0


def html_to_pdf_story_fallback(
    prepared_html: str,
    pdf_out_path: str,
    page_size: str = "a4",
    orientation: str = "portrait"
) -> None:
    mediabox = pymupdf.paper_rect(page_size.lower() if page_size.lower() in ["a4", "letter"] else "a4")
    if orientation.lower() == "landscape":
        mediabox = pymupdf.Rect(0, 0, mediabox.height, mediabox.width)
    
    margin = 36.0
    body_rect = pymupdf.Rect(margin, margin, mediabox.width - margin, mediabox.height - margin)

    story = pymupdf.Story(prepared_html)
    writer = pymupdf.DocumentWriter(pdf_out_path)
    story.write(writer, lambda n, f: (mediabox, body_rect, pymupdf.Matrix(1, 1)))
    writer.close()


def html_to_pdf_convert(
    raw_html: str,
    pdf_out_path: str,
    page_size: str = "a4",
    orientation: str = "portrait",
    margin: str = "normal",
    print_background: bool = True
) -> dict:
    prepared = prepare_html_with_page_options(raw_html, page_size, orientation, margin, print_background)
    
    temp_html = tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8")
    temp_html.write(prepared)
    temp_html.close()
    temp_html_path = temp_html.name

    engine_used = "chromium"
    try:
        browser_exe = find_chromium_browser()
        success = False
        if browser_exe:
            success = html_to_pdf_chromium(temp_html_path, pdf_out_path, browser_exe)

        if not success or not os.path.exists(pdf_out_path) or os.path.getsize(pdf_out_path) == 0:
            html_to_pdf_story_fallback(prepared, pdf_out_path, page_size, orientation)
            engine_used = "story-fallback"
    finally:
        if os.path.exists(temp_html_path):
            try:
                os.remove(temp_html_path)
            except OSError:
                pass

    doc_out = pymupdf.open(pdf_out_path)
    page_count = len(doc_out)
    doc_out.close()

    return {
        "page_count": page_count,
        "engine": engine_used
    }


def validate_url_safe(url_str: str) -> str:
    parsed = urllib.parse.urlparse(url_str)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL scheme. Only http:// and https:// URLs are allowed."
        )
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL hostname."
        )

    if hostname.lower() in ("localhost", "127.0.0.1", "::1", "metadata.google.internal"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access to local or internal metadata addresses is prohibited."
        )

    try:
        addrinfo = socket.getaddrinfo(hostname, None)
        for entry in addrinfo:
            ip_str = entry[4][0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Access to private, loopback, or reserved network addresses is prohibited."
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not resolve URL hostname: {str(e)}"
        )
    return url_str


@app.post("/api/convert-html-to-pdf")
@limiter.limit("15/minute")
async def convert_html_to_pdf(request: Request, 
    file: Optional[UploadFile] = File(None),
    html_text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    page_size: str = Form("a4"),
    orientation: str = Form("portrait"),
    margin: str = Form("normal"),
    print_background: bool = Form(True)
):
    raw_html = ""
    source_name = "glowpdf_html_to_pdf"

    if url is not None and url.strip():
        safe_url = validate_url_safe(url.strip())
        import urllib.request
        try:
            req = urllib.request.Request(
                safe_url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 GlowPDF/2.0"}
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw_html = resp.read().decode("utf-8", errors="replace")
            parsed_u = urllib.parse.urlparse(safe_url)
            source_name = (parsed_u.netloc + parsed_u.path).replace("/", "_").strip("_") or "webpage"
        except Exception as u_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch webpage content from URL: {str(u_err)}"
            )
    elif file is not None and file.filename:
        filename = file.filename
        source_name = os.path.splitext(filename)[0] or "glowpdf_html_to_pdf"
        if not (filename.lower().endswith(".html") or filename.lower().endswith(".htm")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format. Only HTML files (.html, .htm) are supported."
            )
        content_bytes = await file.read()
        if len(content_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded HTML file is empty."
            )
        try:
            raw_html = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                raw_html = content_bytes.decode("latin-1")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not decode the HTML file. Please ensure it is saved with UTF-8 encoding."
                )
    elif html_text is not None and html_text.strip():
        raw_html = html_text.strip()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No HTML content or URL provided. Please upload an HTML file, provide a URL, or enter HTML code."
        )

    if not raw_html.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HTML content is empty."
        )


    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out_path = temp_out.name
    temp_out.close()

    try:
        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(
                        html_to_pdf_convert,
                        raw_html,
                        temp_out_path,
                        page_size,
                        orientation,
                        margin,
                        print_background
                    ),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="HTML to PDF conversion timed out after 90 seconds."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"HTML to PDF conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output PDF could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            pdf_bytes = f.read()

        download_name = f"{source_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Pages": str(meta.get("page_count", 1)),
                "X-Engine": meta.get("engine", "chromium"),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages, X-Engine"
            }
        )
    finally:
        safe_remove_file(temp_out_path)


def pdf_to_pptx_convert(pdf_path: str, output_pptx: str) -> dict:
    pdf_doc = pymupdf.open(pdf_path)
    total_pages = len(pdf_doc)
    if total_pages == 0:
        raise ValueError("PDF document contains no readable pages.")
        
    prs = Presentation()
    blank_layout = prs.slide_layouts[6]
    
    first_page = pdf_doc[0]
    prs.slide_width = Pt(first_page.rect.width)
    prs.slide_height = Pt(first_page.rect.height)
    
    total_text_boxes = 0
    total_images = 0
    total_shapes = 0
    
    for page_idx, page in enumerate(pdf_doc):
        slide = prs.slides.add_slide(blank_layout)
        page_rect = page.rect
        
        # 1. Native Table Detection & Extraction
        table_bboxes = []
        try:
            detected_tables = page.find_tables()
            for tab in detected_tables:
                table_bboxes.append(pymupdf.Rect(tab.bbox))
                df_data = tab.extract()
                if not df_data or len(df_data) == 0:
                    continue
                num_rows = len(df_data)
                num_cols = len(df_data[0]) if num_rows > 0 else 0
                if num_cols == 0:
                    continue
                
                x0, y0, x1, y1 = tab.bbox
                tbl_shape = slide.shapes.add_table(num_rows, num_cols, Pt(x0), Pt(y0), Pt(max(10.0, x1 - x0)), Pt(max(10.0, y1 - y0)))
                tbl = tbl_shape.table
                for r_idx, row in enumerate(df_data):
                    for c_idx, val in enumerate(row):
                        cell = tbl.cell(r_idx, c_idx)
                        cell.text = str(val or "").strip()
                        if r_idx == 0:
                            for p in cell.text_frame.paragraphs:
                                p.font.bold = True
                                p.font.size = Pt(10)
                        else:
                            for p in cell.text_frame.paragraphs:
                                p.font.size = Pt(9.5)
                total_shapes += 1
        except Exception:
            pass

        # 2. Vector Drawings, Backgrounds & Shapes
        try:
            drawings = page.get_drawings()
            for draw in drawings:
                r = pymupdf.Rect(draw["rect"])
                if r.width < 2 or r.height < 2:
                    continue
                fill = draw.get("fill")
                color = draw.get("color")
                width = draw.get("width", 1.0)
                
                # Avoid full page opaque white background overdrawing
                if abs(r.width - page_rect.width) < 2 and abs(r.height - page_rect.height) < 2 and fill == (1, 1, 1):
                    continue
                
                # Check if inside detected table
                if any(r in t_box or t_box.contains(r) for t_box in table_bboxes):
                    continue
                    
                if fill:
                    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Pt(r.x0), Pt(r.y0), Pt(r.width), Pt(r.height))
                    shape.fill.solid()
                    shape.fill.fore_color.rgb = RGBColor(int(fill[0]*255), int(fill[1]*255), int(fill[2]*255))
                    if color:
                        shape.line.color.rgb = RGBColor(int(color[0]*255), int(color[1]*255), int(color[2]*255))
                        shape.line.width = Pt(width)
                    else:
                        shape.line.fill.background()
                    total_shapes += 1
                elif color and (r.height <= 3.0 or r.width <= 3.0):
                    # Decorative lines
                    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Pt(r.x0), Pt(r.y0), Pt(max(1.0, r.width)), Pt(max(1.0, r.height)))
                    shape.fill.solid()
                    shape.fill.fore_color.rgb = RGBColor(int(color[0]*255), int(color[1]*255), int(color[2]*255))
                    shape.line.fill.background()
                    total_shapes += 1
        except Exception:
            pass

        # 3. Embedded Raster Images
        image_info = page.get_image_info(xrefs=True)
        for img in image_info:
            xref = img.get("xref")
            bbox = img.get("bbox")
            if xref and bbox:
                x0, y0, x1, y1 = bbox
                w = x1 - x0
                h = y1 - y0
                if w > 2 and h > 2:
                    try:
                        base_img = pdf_doc.extract_image(xref)
                        img_bytes = base_img.get("image")
                        if img_bytes:
                            slide.shapes.add_picture(io.BytesIO(img_bytes), Pt(x0), Pt(y0), Pt(w), Pt(h))
                            total_images += 1
                    except Exception:
                        pass

        # 4. Text Extraction with detailed typography & styling
        text_dict = page.get_text("dict", flags=pymupdf.TEXTFLAGS_SEARCH)
        blocks = text_dict.get("blocks", [])
        
        has_text = False
        for b in blocks:
            if b.get("type") != 0:
                continue
            b_rect = pymupdf.Rect(b["bbox"])
            if any(b_rect in t_box or t_box.contains(b_rect) for t_box in table_bboxes):
                continue
                
            lines = b.get("lines", [])
            if not lines:
                continue
            
            bx0, by0, bx1, by1 = b["bbox"]
            bw = max(20.0, bx1 - bx0)
            bh = max(12.0, by1 - by0)
            
            tx_box = slide.shapes.add_textbox(Pt(bx0), Pt(by0), Pt(bw + 6), Pt(bh + 6))
            tf = tx_box.text_frame
            tf.word_wrap = True
            tf.margin_left = Pt(0)
            tf.margin_top = Pt(0)
            tf.margin_right = Pt(0)
            tf.margin_bottom = Pt(0)
            
            first_p = True
            for line in lines:
                spans = line.get("spans", [])
                if not spans:
                    continue
                p = tf.paragraphs[0] if first_p else tf.add_paragraph()
                first_p = False
                p.line_spacing = 1.15
                
                for span in spans:
                    text_str = span.get("text", "")
                    if not text_str:
                        continue
                    has_text = True
                    run = p.add_run()
                    run.text = text_str
                    
                    font_name = span.get("font", "Calibri")
                    clean_font = font_name.split("+")[-1].split("-")[0]
                    run.font.name = clean_font
                    
                    size = span.get("size", 11.0)
                    run.font.size = Pt(size)
                    
                    flags = span.get("flags", 0)
                    run.font.bold = bool(flags & 2**4) or "bold" in font_name.lower()
                    run.font.italic = bool(flags & 2**1) or "italic" in font_name.lower()
                    
                    c = span.get("color", 0)
                    r = (c >> 16) & 255
                    g = (c >> 8) & 255
                    b_col = c & 255
                    run.font.color.rgb = RGBColor(r, g, b_col)
            
            total_text_boxes += 1
            
        # 5. Scanned / image-only fallback
        if not has_text and len(image_info) == 0:
            pix = page.get_pixmap(dpi=150)
            slide.shapes.add_picture(io.BytesIO(pix.tobytes("png")), Pt(0), Pt(0), Pt(page_rect.width), Pt(page_rect.height))

    prs.save(output_pptx)
    pdf_doc.close()
    
    return {
        "slides": total_pages,
        "text_boxes": total_text_boxes,
        "images": total_images,
        "shapes": total_shapes,
        "file_size": os.path.getsize(output_pptx)
    }


@app.post("/api/convert-pdf-to-powerpoint")
@limiter.limit("15/minute")
async def convert_pdf_to_powerpoint(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "presentation.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    # Validate structure and password encryption
    try:
        pdf_doc = pymupdf.open(stream=content, filetype="pdf")
        if pdf_doc.is_encrypted or pdf_doc.needs_pass:
            pdf_doc.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This PDF document is password-protected. Please unlock it using GlowPDF's Unlock tool before converting to PowerPoint."
            )
        total_pages = len(pdf_doc)
        if total_pages == 0:
            pdf_doc.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The selected PDF contains no readable pages."
            )
        pdf_doc.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not open or parse PDF document: {str(e)}"
        )

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pptx", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(pdf_to_pptx_convert, temp_in_path, temp_out_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PDF to PowerPoint conversion timed out. Please verify document complexity."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"PDF to PowerPoint conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output PowerPoint presentation could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            pptx_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_presentation"
        download_name = f"{base_name}.pptx"

        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Slides": str(meta.get("slides", total_pages)),
                "X-Text-Boxes": str(meta.get("text_boxes", 0)),
                "X-Shapes": str(meta.get("shapes", 0)),
                "X-Images": str(meta.get("images", 0)),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Slides, X-Text-Boxes, X-Shapes, X-Images"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)



def parse_excel_cell_value(text):
    if text is None:
        return None, "empty"
    s = str(text).strip()
    if not s:
        return "", "empty"

    # Financial parentheses negative e.g. ($1,250.00) or (500)
    if s.startswith("(") and s.endswith(")"):
        inner = s[1:-1].strip()
        if re.match(r'^[\$€£¥]?\s*[\d,]+(?:\.\d+)?$', inner):
            s = "-" + inner

    # Currency format e.g. $1,250.00, €450.50, £99.99
    curr_match = re.match(r'^([\$€£¥])\s*([+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)$', s)
    if not curr_match:
        curr_match = re.match(r'^([+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*([\$€£¥])$', s)
    if curr_match:
        num_str = curr_match.group(2) if curr_match.group(1) in "$€£¥" else curr_match.group(1)
        try:
            return float(num_str.replace(",", "")), "currency"
        except ValueError:
            pass

    # Percentage e.g. 15.5% or -2.4%
    if s.endswith("%"):
        pct_str = s[:-1].strip()
        try:
            val = float(pct_str) / 100.0
            return val, "percentage"
        except ValueError:
            pass

    # Standard Integer e.g. 1,000 or -45
    if re.match(r'^[+-]?\d{1,3}(?:,\d{3})+$', s):
        try:
            return int(s.replace(",", "")), "integer"
        except ValueError:
            pass
    if re.match(r'^[+-]?\d+$', s):
        try:
            return int(s), "integer"
        except ValueError:
            pass

    # Decimal Float e.g. 1234.56 or -0.05
    if re.match(r'^[+-]?\d*\.\d+$', s):
        try:
            return float(s), "decimal"
        except ValueError:
            pass

    # Dates e.g. 2026-09-17 or 09/17/2026
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s) or re.match(r'^\d{2}/\d{2}/\d{4}$', s):
        return s, "date"

    # Clean text (remove multiple interior spaces, clean multiline)
    cleaned_text = re.sub(r'[ \t]+', ' ', s)
    return cleaned_text, "text"


def pdf_to_excel_convert(pdf_path: str, output_xlsx: str):
    wb = xlsxwriter.Workbook(output_xlsx)

    # Reusable cell formats
    f_header = wb.add_format({
        "bold": True,
        "font_name": "Calibri",
        "font_size": 11,
        "font_color": "#FFFFFF",
        "bg_color": "#1E3A8A", # Dark Navy Blue
        "border": 1,
        "border_color": "#94A3B8",
        "align": "left",
        "valign": "vcenter"
    })
    f_total_text = wb.add_format({
        "bold": True,
        "font_name": "Calibri",
        "font_size": 11,
        "font_color": "#0F172A",
        "bg_color": "#F1F5F9",
        "border": 1,
        "border_color": "#CBD5E1",
        "valign": "vcenter"
    })
    f_total_curr = wb.add_format({
        "bold": True,
        "font_name": "Calibri",
        "font_size": 11,
        "font_color": "#0F172A",
        "bg_color": "#F1F5F9",
        "border": 1,
        "border_color": "#CBD5E1",
        "num_format": "$#,##0.00",
        "align": "right",
        "valign": "vcenter"
    })
    f_title = wb.add_format({
        "bold": True,
        "font_name": "Calibri",
        "font_size": 13,
        "font_color": "#1E3A8A",
        "valign": "vcenter"
    })
    f_meta = wb.add_format({
        "italic": True,
        "font_name": "Calibri",
        "font_size": 10,
        "font_color": "#475569",
        "valign": "vcenter"
    })
    f_text = wb.add_format({
        "font_name": "Calibri",
        "font_size": 10,
        "border": 1,
        "border_color": "#E2E8F0",
        "valign": "vcenter"
    })
    f_curr = wb.add_format({
        "font_name": "Calibri",
        "font_size": 10,
        "border": 1,
        "border_color": "#E2E8F0",
        "num_format": "$#,##0.00",
        "align": "right",
        "valign": "vcenter"
    })
    f_int = wb.add_format({
        "font_name": "Calibri",
        "font_size": 10,
        "border": 1,
        "border_color": "#E2E8F0",
        "num_format": "#,##0",
        "align": "right",
        "valign": "vcenter"
    })
    f_dec = wb.add_format({
        "font_name": "Calibri",
        "font_size": 10,
        "border": 1,
        "border_color": "#E2E8F0",
        "num_format": "#,##0.00",
        "align": "right",
        "valign": "vcenter"
    })
    f_pct = wb.add_format({
        "font_name": "Calibri",
        "font_size": 10,
        "border": 1,
        "border_color": "#E2E8F0",
        "num_format": "0.00%",
        "align": "right",
        "valign": "vcenter"
    })
    f_date = wb.add_format({
        "font_name": "Calibri",
        "font_size": 10,
        "border": 1,
        "border_color": "#E2E8F0",
        "num_format": "yyyy-mm-dd",
        "align": "center",
        "valign": "vcenter"
    })

    main_ws = wb.add_worksheet("Sheet1")
    total_tables = 0
    total_rows = 0
    max_cols = 0
    current_main_row = 0
    col_widths = {}

    def write_row_cells(ws, row_idx, row_data, is_header=False):
        nonlocal max_cols
        if len(row_data) > max_cols:
            max_cols = len(row_data)

        is_summary = any(
            kw in str(c or "").lower()
            for kw in ["total", "subtotal", "balance due", "grand total", "net amount", "balance"]
            for c in row_data
        )

        for c_idx, cell in enumerate(row_data):
            val, val_type = parse_excel_cell_value(cell)
            val_len = len(str(cell or ""))
            col_widths[c_idx] = max(col_widths.get(c_idx, 10), min(val_len + 4, 50))

            if is_header:
                ws.write(row_idx, c_idx, val if val is not None else "", f_header)
            elif is_summary:
                if val_type == "currency":
                    ws.write_number(row_idx, c_idx, val, f_total_curr)
                else:
                    ws.write(row_idx, c_idx, val if val is not None else "", f_total_text)
            elif val_type == "currency":
                ws.write_number(row_idx, c_idx, val, f_curr)
            elif val_type == "integer":
                ws.write_number(row_idx, c_idx, val, f_int)
            elif val_type == "decimal":
                ws.write_number(row_idx, c_idx, val, f_dec)
            elif val_type == "percentage":
                ws.write_number(row_idx, c_idx, val, f_pct)
            elif val_type == "date":
                ws.write(row_idx, c_idx, val, f_date)
            else:
                ws.write(row_idx, c_idx, val if val is not None else "", f_text)

    with pdfplumber.open(pdf_path) as pdf:
        num_pages = len(pdf.pages)
        page_sheets = []
        if num_pages > 1:
            for p in range(num_pages):
                page_sheets.append(wb.add_worksheet(f"Page {p + 1}"))

        for p_idx, page in enumerate(pdf.pages):
            page_ws = page_sheets[p_idx] if num_pages > 1 else None
            page_row = 0

            # 1. Try finding tables with bounding boxes
            tables_found = page.find_tables()
            if not tables_found:
                # Fallback to text strategy
                tables_found = page.find_tables({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text"
                })

            if tables_found:
                # Extract any words above the first table as title/metadata
                first_t_top = min(t.bbox[1] for t in tables_found)
                words_above = [w for w in page.extract_words() if w['bottom'] <= first_t_top]
                if words_above:
                    words_sorted = sorted(words_above, key=lambda w: (round(w['top'] / 6) * 6, w['x0']))
                    for _, grp in groupby(words_sorted, key=lambda w: round(w['top'] / 6) * 6):
                        line_text = " ".join(w['text'] for w in grp).strip()
                        if line_text:
                            fmt = f_title if current_main_row == 0 else f_meta
                            main_ws.write(current_main_row, 0, line_text, fmt)
                            if page_ws:
                                page_ws.write(page_row, 0, line_text, fmt)
                            current_main_row += 1
                            page_row += 1
                    current_main_row += 1
                    if page_ws:
                        page_row += 1

                for t_obj in tables_found:
                    raw_data = t_obj.extract()
                    if not raw_data or len(raw_data) == 0:
                        continue

                    total_tables += 1
                    header_written = False

                    for r_idx, row in enumerate(raw_data):
                        if not any(cell and str(cell).strip() for cell in row):
                            continue

                        total_rows += 1
                        is_hdr = (r_idx == 0 and not header_written)
                        write_row_cells(main_ws, current_main_row, row, is_header=is_hdr)
                        if page_ws:
                            write_row_cells(page_ws, page_row, row, is_header=is_hdr)
                            page_row += 1

                        header_written = True
                        current_main_row += 1

                    current_main_row += 2
                    if page_ws:
                        page_row += 2
            else:
                # Fallback for pages without standard tables: extract text lines
                text = page.extract_text()
                if text:
                    lines = text.split("\n")
                    for line in lines:
                        if not line.strip():
                            continue
                        parts = re.split(r'\s{3,}|\t', line.strip())
                        write_row_cells(main_ws, current_main_row, parts, is_header=False)
                        if page_ws:
                            write_row_cells(page_ws, page_row, parts, is_header=False)
                            page_row += 1
                        current_main_row += 1
                        total_rows += 1

            if page_ws:
                for c, w in col_widths.items():
                    page_ws.set_column(c, c, w)

        # Apply column widths to main sheet
        for c_idx, w in col_widths.items():
            main_ws.set_column(c_idx, c_idx, w)

    wb.close()
    return {
        "tables": total_tables,
        "rows": total_rows,
        "columns": max_cols,
        "sheets": 1 + (num_pages if num_pages > 1 else 0)
    }


@app.post("/api/convert-pdf-to-excel")
@limiter.limit("15/minute")
async def convert_pdf_to_excel(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    # 1. Inspect with PyMuPDF for password encryption
    try:
        pdf_test = pymupdf.open(stream=content, filetype="pdf")
        if pdf_test.is_encrypted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This PDF document is password-protected. Please unlock it using GlowPDF's Unlock tool before converting to Excel."
            )
        total_pages = len(pdf_test)
        if total_pages == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The PDF document contains 0 pages."
            )
        pdf_test.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not open or parse PDF document: {str(e)}"
        )

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(pdf_to_excel_convert, temp_in_path, temp_out_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Conversion timed out. The document may be too large or complex for standard processing."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"PDF to Excel conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output Excel spreadsheet could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            xlsx_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_spreadsheet"
        download_name = f"{base_name}.xlsx"

        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Table-Count": str(meta.get("tables", 0)),
                "X-Row-Count": str(meta.get("rows", 0)),
                "X-Column-Count": str(meta.get("columns", 0)),
                "X-Sheet-Count": str(meta.get("sheets", 1)),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Table-Count, X-Row-Count, X-Column-Count, X-Sheet-Count"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 5: EXCEL -> PDF ENDPOINT
# ==============================================================================
@app.post("/api/convert-excel-to-pdf")
@limiter.limit("15/minute")
async def convert_excel_to_pdf(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "spreadsheet.xlsx"
    ext = os.path.splitext(filename)[1].lower()
    content = await file.read()
    validate_file_upload(content, filename, (".xlsx", ".xls"))

    temp_in = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(convert_excel_to_pdf_multitier, temp_in_path, temp_out_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Excel conversion timed out."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Excel to PDF conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output PDF could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            pdf_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_excel"
        download_name = f"{base_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Pages": str(meta.get("page_count", 1)),
                "X-Total-Worksheets": str(meta.get("worksheets", 1)),
                "X-Total-Rows": str(meta.get("rows", 0)),
                "X-Total-Cells": str(meta.get("cells", 0)),
                "X-Engine": str(meta.get("engine", "Multi-tier")),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages, X-Total-Worksheets, X-Total-Rows, X-Total-Cells, X-Engine"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 6: POWERPOINT -> PDF ENDPOINT
# ==============================================================================
@app.post("/api/convert-powerpoint-to-pdf")
@limiter.limit("15/minute")
async def convert_powerpoint_to_pdf(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "presentation.pptx"
    ext = os.path.splitext(filename)[1].lower()
    content = await file.read()
    validate_file_upload(content, filename, (".pptx", ".ppt"))

    temp_in = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(convert_pptx_to_pdf_multitier, temp_in_path, temp_out_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PowerPoint conversion timed out."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"PowerPoint to PDF conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output PDF could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            pdf_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_presentation"
        download_name = f"{base_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Pages": str(meta.get("page_count", 1)),
                "X-Total-Slides": str(meta.get("slide_count", 1)),
                "X-Images": str(meta.get("images", 0)),
                "X-Tables": str(meta.get("tables", 0)),
                "X-Shapes": str(meta.get("shapes", 0)),
                "X-Engine": str(meta.get("engine", "Multi-tier")),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages, X-Total-Slides, X-Images, X-Tables, X-Shapes, X-Engine"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 12: PDF -> PDF/A CONVERSION ENDPOINT
# ==============================================================================
@app.post("/api/convert-pdf-to-pdfa")
@limiter.limit("15/minute")
async def convert_pdf_to_pdfa_endpoint(request: Request, 
    file: UploadFile = File(...),
    standard: str = Form("PDF/A-2b")
):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(convert_pdf_to_pdfa, temp_in_path, temp_out_path, standard),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PDF/A conversion timed out."
                )
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"PDF/A conversion failed: {str(conv_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Conversion finished but output PDF/A document could not be generated."
            )

        with open(temp_out_path, "rb") as f:
            pdfa_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_archival"
        download_name = f"{base_name}_PDFA.pdf"

        return Response(
            content=pdfa_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-PDFA-Standard": meta.get("standard", standard),
                "X-Engine": meta.get("engine", "PyMuPDF/Ghostscript"),
                "Access-Control-Expose-Headers": "Content-Disposition, X-PDFA-Standard, X-Engine"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 9: ADVANCED PDF COMPRESSION ENDPOINT
# ==============================================================================
@app.post("/api/compress-pdf")
@limiter.limit("15/minute")
async def compress_pdf_endpoint(request: Request, 
    file: UploadFile = File(...),
    level: str = Form("recommended")
):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(compress_pdf_multitier, temp_in_path, temp_out_path, level),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Compression timed out."
                )
            except Exception as comp_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Compression failed: {str(comp_err)}"
                )

        with open(temp_out_path, "rb") as f:
            comp_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_compressed"
        download_name = f"{base_name}_compressed.pdf"

        return Response(
            content=comp_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Original-Size": str(meta.get("original_size", len(content))),
                "X-Compressed-Size": str(meta.get("compressed_size", len(comp_bytes))),
                "X-Percent-Saved": str(meta.get("percent_saved", 0.0)),
                "X-Engine": meta.get("engine", "Multi-tier Compressor"),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Original-Size, X-Compressed-Size, X-Percent-Saved, X-Engine"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 10: PDF REPAIR ENDPOINT
# ==============================================================================
@app.post("/api/repair-pdf")
@limiter.limit("15/minute")
async def repair_pdf_endpoint(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf")

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(repair_pdf_multitier, temp_in_path, temp_out_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PDF repair timed out."
                )
            except Exception as rep_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF repair failed: {str(rep_err)}"
                )

        with open(temp_out_path, "rb") as f:
            repaired_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_repaired"
        download_name = f"{base_name}_repaired.pdf"

        return Response(
            content=repaired_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Repair-Status": meta.get("status", "repaired"),
                "X-Engine": meta.get("engine", "QPDF / PyMuPDF Xref"),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Repair-Status, X-Engine"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 11: OCR PDF ENDPOINT
# ==============================================================================
@app.post("/api/ocr-pdf")
@limiter.limit("15/minute")
async def ocr_pdf_endpoint(request: Request, 
    file: UploadFile = File(...),
    language: str = Form("eng")
):
    filename = file.filename or "scanned_doc.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(ocr_pdf_multitier, temp_in_path, temp_out_path, language),
                    timeout=120
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="OCR processing timed out."
                )
            except Exception as ocr_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OCR processing failed: {str(ocr_err)}"
                )

        with open(temp_out_path, "rb") as f:
            ocr_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_ocr"
        download_name = f"{base_name}_searchable.pdf"

        return Response(
            content=ocr_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-OCR-Engine": meta.get("engine", "OCR Engine"),
                "X-Language": meta.get("language", language),
                "Access-Control-Expose-Headers": "Content-Disposition, X-OCR-Engine, X-Language"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 14: ADD PAGE NUMBERS ENDPOINT
# ==============================================================================
@app.post("/api/add-page-numbers")
@limiter.limit("15/minute")
async def add_page_numbers_endpoint(request: Request, 
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    start_number: int = Form(1),
    prefix: str = Form(""),
    suffix: str = Form(""),
    font_size: float = Form(10.0)
):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                total_pages = await asyncio.wait_for(
                    asyncio.to_thread(
                        add_page_numbers_to_pdf,
                        temp_in_path,
                        temp_out_path,
                        position,
                        start_number,
                        prefix,
                        suffix,
                        font_size
                    ),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Adding page numbers timed out."
                )
            except Exception as num_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Adding page numbers failed: {str(num_err)}"
                )

        with open(temp_out_path, "rb") as f:
            numbered_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_numbered"
        download_name = f"{base_name}_numbered.pdf"

        return Response(
            content=numbered_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Pages": str(total_pages),
                "X-Position": position,
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Pages, X-Position"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 15: PDF REDACTION ENDPOINT (True Content Purge)
# ==============================================================================
@app.post("/api/redact-pdf")
@limiter.limit("15/minute")
async def redact_pdf_endpoint(request: Request, 
    file: UploadFile = File(...),
    search_terms: Optional[str] = Form(None),
    rectangles_json: Optional[str] = Form(None)
):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    terms_list = [t.strip() for t in search_terms.split(",")] if search_terms else []
    rects_list = []
    if rectangles_json:
        try:
            rects_list = json.loads(rectangles_json)
        except Exception:
            pass

    if not terms_list and not rects_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No redaction targets specified. Provide text search terms or area coordinates."
        )

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                redact_count = await asyncio.wait_for(
                    asyncio.to_thread(
                        redact_pdf_content,
                        temp_in_path,
                        temp_out_path,
                        terms_list,
                        rects_list
                    ),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Redaction timed out."
                )
            except Exception as red_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Redaction failed: {str(red_err)}"
                )

        with open(temp_out_path, "rb") as f:
            redacted_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_redacted"
        download_name = f"{base_name}_redacted.pdf"

        return Response(
            content=redacted_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Total-Redactions": str(redact_count),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Total-Redactions"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 16: PDF FORMS (Inspect & Fill)
# ==============================================================================
@app.post("/api/inspect-pdf-forms")
@limiter.limit("15/minute")
async def inspect_pdf_forms_endpoint(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "form.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_in.close()
    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)
        async with conversion_semaphore:
            fields = await asyncio.wait_for(
                asyncio.to_thread(inspect_pdf_forms, temp_in_path),
                timeout=60
            )
        return {"fields": fields, "field_count": len(fields)}
    finally:
        safe_remove_file(temp_in_path)


@app.post("/api/fill-pdf-forms")
@limiter.limit("15/minute")
async def fill_pdf_forms_endpoint(request: Request, 
    file: UploadFile = File(...),
    form_data_json: str = Form(...),
    flatten: bool = Form(False)
):
    filename = file.filename or "form.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    try:
        field_values = json.loads(form_data_json)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid form_data_json format. Must be a valid JSON object mapping field names to values."
        )

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                updated_count = await asyncio.wait_for(
                    asyncio.to_thread(fill_pdf_forms, temp_in_path, temp_out_path, field_values, flatten),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Form filling timed out."
                )

        with open(temp_out_path, "rb") as f:
            filled_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_filled"
        download_name = f"{base_name}_filled.pdf"

        return Response(
            content=filled_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Fields-Updated": str(updated_count),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Fields-Updated"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 17: DIGITAL SIGNATURES & VISUAL STAMPS
# ==============================================================================
@app.post("/api/sign-pdf")
@limiter.limit("15/minute")
async def sign_pdf_endpoint(request: Request, 
    file: UploadFile = File(...),
    signature_file: Optional[UploadFile] = File(None),
    cert_file: Optional[UploadFile] = File(None),
    cert_passphrase: Optional[str] = Form(None),
    page_index: int = Form(0)
):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    sig_bytes = await signature_file.read() if signature_file else None
    cert_bytes = await cert_file.read() if cert_file else None

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_out = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.close()
    temp_out.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                meta = await asyncio.wait_for(
                    asyncio.to_thread(
                        sign_pdf_visual_or_cert,
                        temp_in_path,
                        temp_out_path,
                        sig_bytes,
                        cert_bytes,
                        cert_passphrase,
                        page_index
                    ),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PDF signing timed out."
                )

        with open(temp_out_path, "rb") as f:
            signed_bytes = f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_signed"
        download_name = f"{base_name}_signed.pdf"

        return Response(
            content=signed_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "X-Signature-Type": meta.get("type", "visual"),
                "X-Signature-Engine": meta.get("engine", "pyHanko / PyMuPDF"),
                "Access-Control-Expose-Headers": "Content-Disposition, X-Signature-Type, X-Signature-Engine"
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


# ==============================================================================
# PHASE 20: PDF -> MARKDOWN STRUCTURAL CONVERSION
# ==============================================================================
@app.post("/api/convert-pdf-to-markdown")
@limiter.limit("15/minute")
async def convert_pdf_to_markdown_endpoint(request: Request, file: UploadFile = File(...)):
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_in_path = temp_in.name
    temp_in.close()

    try:
        with open(temp_in_path, "wb") as f:
            f.write(content)

        async with conversion_semaphore:
            try:
                md_content = await asyncio.wait_for(
                    asyncio.to_thread(convert_pdf_to_markdown, temp_in_path),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="Markdown conversion timed out."
                )

        base_name = os.path.splitext(filename)[0] or "glowpdf_document"
        download_name = f"{base_name}.md"

        return Response(
            content=md_content.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    finally:
        safe_remove_file(temp_in_path)


# ==============================================================================
# PHASE 26: ADVANCED PDF EDITING & SANITIZATION ENDPOINT
# ==============================================================================
@app.post("/api/pdf/edit")
@limiter.limit("15/minute")
async def api_edit_pdf(
    request: Request,
    file: UploadFile = File(...),
    operations: str = Form("{}")
):
    """
    Apply comprehensive vector, text, image, drawing, annotation, redaction, and page operations.
    Returns the sanitized, updated, and validated PDF document.
    """
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    try:
        ops_dict = json.loads(operations)
        if not isinstance(ops_dict, dict):
            ops_dict = {}
    except Exception as parse_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid operations JSON: {str(parse_err)}"
        )

    temp_in_path = None
    temp_out_path = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f_in:
            f_in.write(content)
            temp_in_path = f_in.name

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f_out:
            temp_out_path = f_out.name

        async with conversion_semaphore:
            try:
                res = await asyncio.wait_for(
                    asyncio.to_thread(apply_pdf_edits, temp_in_path, temp_out_path, ops_dict),
                    timeout=90
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PDF editing operation timed out."
                )
            except ValueError as val_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(val_err)
                )
            except Exception as proc_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"PDF editing failed: {str(proc_err)}"
                )

        if not os.path.exists(temp_out_path) or os.path.getsize(temp_out_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Output PDF generation produced empty or missing file."
            )

        with open(temp_out_path, "rb") as out_f:
            pdf_bytes = out_f.read()

        base_name = os.path.splitext(filename)[0] or "glowpdf_document"
        download_name = f"edited_{base_name}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
                "X-Pages-Processed": str(res.get("pages", 1))
            }
        )
    finally:
        safe_remove_file(temp_in_path)
        safe_remove_file(temp_out_path)


@app.post("/api/pdf/analyze")
@limiter.limit("15/minute")
async def api_analyze_pdf(
    request: Request,
    file: UploadFile = File(...),
):
    """
    Analyze a PDF for the Edit-PDF editor: returns page dimensions plus the
    existing text spans and raster images, positioned in unrotated PDF point
    coordinates (top-left origin). Read-only; the original file is returned.
    """
    filename = file.filename or "document.pdf"
    content = await file.read()
    validate_file_upload(content, filename, ".pdf", b"%PDF-", content_type=file.content_type, allowed_mime_types=["application/pdf", "application/x-pdf", "application/octet-stream"])

    temp_in_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f_in:
            f_in.write(content)
            temp_in_path = f_in.name

        async with conversion_semaphore:
            try:
                analysis = await asyncio.wait_for(
                    asyncio.to_thread(analyze_pdf_content, temp_in_path),
                    timeout=60
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="PDF analysis timed out."
                )
            except ValueError as val_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(val_err)
                )
            except Exception as proc_err:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"PDF analysis failed: {str(proc_err)}"
                )

        return JSONResponse(content=analysis)
    finally:
        safe_remove_file(temp_in_path)


# ==============================================================================
# PHASE 25: ENGINE REGISTRY & CAPABILITY AUDIT ENDPOINT
# ==============================================================================
@app.get("/api/engine-registry")
def api_engine_registry():
    return get_engine_registry()


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)




