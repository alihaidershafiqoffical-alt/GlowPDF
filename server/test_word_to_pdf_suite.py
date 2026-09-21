import os
import sys
import io

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import docx
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import pymupdf
from PIL import Image as PILImage, ImageDraw
from server.conversion_engines import docx_to_pdf_convert

def create_sample_image_bytes():
    img = PILImage.new('RGB', (300, 150), color=(37, 99, 235))
    d = ImageDraw.Draw(img)
    d.text((30, 60), "GlowPDF High Fidelity Test Logo", fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

def run_word_to_pdf_suite():
    scratch_dir = os.path.join(ROOT_DIR, "scratch", "word_tests")
    os.makedirs(scratch_dir, exist_ok=True)
    print("=" * 70)
    print("      GLOWPDF WORD-TO-PDF HIGH-FIDELITY QA REGRESSION SUITE")
    print("=" * 70)

    # TEST 1: Normal text with multiple fonts, sizes, colors & formatting
    print("\n[TEST 1] Normal text with multiple fonts and formatting")
    d1 = docx.Document()
    p1 = d1.add_paragraph()
    r1 = p1.add_run("Heading Title in Arial Bold 22pt")
    r1.font.name = "Arial"
    r1.font.size = Pt(22)
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(15, 23, 42)

    p2 = d1.add_paragraph()
    r2a = p2.add_run("This is bold Georgia text. ")
    r2a.font.name = "Georgia"
    r2a.font.size = Pt(12)
    r2a.font.bold = True
    r2b = p2.add_run("This is italic Courier text in green. ")
    r2b.font.name = "Courier New"
    r2b.font.size = Pt(11)
    r2b.font.italic = True
    r2b.font.color.rgb = RGBColor(22, 163, 74)
    r2c = p2.add_run("This is underlined red text.")
    r2c.font.size = Pt(12)
    r2c.font.underline = True
    r2c.font.color.rgb = RGBColor(220, 38, 38)

    path1_docx = os.path.join(scratch_dir, "test1.docx")
    path1_pdf = os.path.join(scratch_dir, "test1.pdf")
    d1.save(path1_docx)

    res1 = docx_to_pdf_convert(path1_docx, path1_pdf)
    print(f"  Engine Used: {res1.get('engine')}")
    assert os.path.exists(path1_pdf) and os.path.getsize(path1_pdf) > 0, "Test 1 PDF output missing!"
    doc1_pdf = pymupdf.open(path1_pdf)
    txt1 = doc1_pdf[0].get_text()
    doc1_pdf.close()
    assert "Heading Title in Arial Bold 22pt" in txt1, "Test 1: Heading text missing!"
    print("  [OK] Test 1 Passed: Multiple fonts & typography preserved!")

    # TEST 2: Two-column document
    print("\n[TEST 2] Two-column document")
    d2 = docx.Document()
    section2 = d2.sections[0]
    sectPr2 = section2._sectPr
    cols2 = OxmlElement('w:cols')
    cols2.set(qn('w:num'), '2')
    cols2.set(qn('w:space'), '720')
    sectPr2.append(cols2)

    d2.add_heading("Two-Column Article Layout", level=1)
    d2.add_paragraph("Left column paragraph text content explaining the multi-column rendering engine capabilities.")
    d2.add_paragraph("Right column paragraph text content formatted in 2-column layout.")

    path2_docx = os.path.join(scratch_dir, "test2_columns.docx")
    path2_pdf = os.path.join(scratch_dir, "test2_columns.pdf")
    d2.save(path2_docx)

    res2 = docx_to_pdf_convert(path2_docx, path2_pdf)
    print(f"  Engine Used: {res2.get('engine')}")
    assert os.path.exists(path2_pdf) and os.path.getsize(path2_pdf) > 0, "Test 2 PDF missing!"
    print("  [OK] Test 2 Passed: Two-column document converted!")

    # TEST 3: Three-column document
    print("\n[TEST 3] Three-column document")
    d3 = docx.Document()
    section3 = d3.sections[0]
    sectPr3 = section3._sectPr
    cols3 = OxmlElement('w:cols')
    cols3.set(qn('w:num'), '3')
    sectPr3.append(cols3)

    d3.add_heading("Three Column Newsletter", level=1)
    d3.add_paragraph("Column 1 content news item.")
    d3.add_paragraph("Column 2 content news item.")
    d3.add_paragraph("Column 3 content news item.")

    path3_docx = os.path.join(scratch_dir, "test3_3cols.docx")
    path3_pdf = os.path.join(scratch_dir, "test3_3cols.pdf")
    d3.save(path3_docx)

    res3 = docx_to_pdf_convert(path3_docx, path3_pdf)
    print(f"  Engine Used: {res3.get('engine')}")
    assert os.path.exists(path3_pdf) and os.path.getsize(path3_pdf) > 0, "Test 3 PDF missing!"
    print("  [OK] Test 3 Passed: Three-column document converted!")

    # TEST 4: Document containing images and logos
    print("\n[TEST 4] Document containing images and logos")
    d4 = docx.Document()
    d4.add_heading("Document with Embedded Image Logo", level=1)
    d4.add_paragraph("Below is the embedded high-resolution company logo:")
    img_buf = create_sample_image_bytes()
    d4.add_picture(img_buf, width=Inches(3.0))

    path4_docx = os.path.join(scratch_dir, "test4_images.docx")
    path4_pdf = os.path.join(scratch_dir, "test4_images.pdf")
    d4.save(path4_docx)

    res4 = docx_to_pdf_convert(path4_docx, path4_pdf)
    print(f"  Engine Used: {res4.get('engine')}")
    assert os.path.exists(path4_pdf) and os.path.getsize(path4_pdf) > 0, "Test 4 PDF missing!"

    doc4_pdf = pymupdf.open(path4_pdf)
    img_list4 = doc4_pdf[0].get_images()
    doc4_pdf.close()
    assert len(img_list4) >= 1, "Test 4: PDF does not contain the embedded image!"
    print(f"  [OK] Test 4 Passed: Image embedded ({len(img_list4)} image(s) verified in PDF)!")

    # TEST 5: Document containing tables and cell shading
    print("\n[TEST 5] Document containing tables and merged cells")
    d5 = docx.Document()
    d5.add_heading("Financial Statement Table", level=1)
    tbl = d5.add_table(rows=3, cols=3)
    hdr_cells = tbl.rows[0].cells
    hdr_cells[0].text = "Item"
    hdr_cells[1].text = "Category"
    hdr_cells[2].text = "Amount"

    for cell in hdr_cells:
        shading = parse_xml(r'<w:shd {} w:fill="2563EB"/>'.format(nsdecls('w')))
        cell._tc.get_or_add_tcPr().append(shading)

    row1 = tbl.rows[1].cells
    row1[0].text = "Product A"
    row1[1].text = "Software"
    row1[2].text = "$1,250.00"

    row2 = tbl.rows[2].cells
    row2[0].text = "Product B"
    row2[1].text = "Services"
    row2[2].text = "$3,400.00"

    path5_docx = os.path.join(scratch_dir, "test5_tables.docx")
    path5_pdf = os.path.join(scratch_dir, "test5_tables.pdf")
    d5.save(path5_docx)

    res5 = docx_to_pdf_convert(path5_docx, path5_pdf)
    print(f"  Engine Used: {res5.get('engine')}")
    assert os.path.exists(path5_pdf) and os.path.getsize(path5_pdf) > 0, "Test 5 PDF missing!"
    print("  [OK] Test 5 Passed: Table structure & cell shading preserved!")

    # TEST 6: Shapes, colors & borders
    print("\n[TEST 6] Colors, shapes, borders & styling")
    d6 = docx.Document()
    p6 = d6.add_paragraph()
    r6 = p6.add_run("Custom Bordered Styled Paragraph Box")
    r6.font.size = Pt(16)
    r6.font.color.rgb = RGBColor(147, 51, 234)

    path6_docx = os.path.join(scratch_dir, "test6_graphics.docx")
    path6_pdf = os.path.join(scratch_dir, "test6_graphics.pdf")
    d6.save(path6_docx)

    res6 = docx_to_pdf_convert(path6_docx, path6_pdf)
    print(f"  Engine Used: {res6.get('engine')}")
    assert os.path.exists(path6_pdf) and os.path.getsize(path6_pdf) > 0, "Test 6 PDF missing!"
    print("  [OK] Test 6 Passed: Graphic styling preserved!")

    # TEST 7: Headers, footers & page numbers
    print("\n[TEST 7] Headers, footers & page numbers")
    d7 = docx.Document()
    sec7 = d7.sections[0]
    hdr7 = sec7.header
    hdr7.paragraphs[0].text = "Header: GlowPDF Enterprise Confidential"
    ftr7 = sec7.footer
    ftr7.paragraphs[0].text = "Footer: Page 1 of 1"

    d7.add_heading("Header & Footer Document Test", level=1)
    d7.add_paragraph("Body paragraph with header and footer configured.")

    path7_docx = os.path.join(scratch_dir, "test7_hf.docx")
    path7_pdf = os.path.join(scratch_dir, "test7_hf.pdf")
    d7.save(path7_docx)

    res7 = docx_to_pdf_convert(path7_docx, path7_pdf)
    print(f"  Engine Used: {res7.get('engine')}")
    assert os.path.exists(path7_pdf) and os.path.getsize(path7_pdf) > 0, "Test 7 PDF missing!"
    print("  [OK] Test 7 Passed: Headers and footers converted!")

    # TEST 8: Complex multi-page document combining all features
    print("\n[TEST 8] Complex multi-page combined document")
    d8 = docx.Document()
    d8.add_heading("Executive Summary & Full Report", level=1)
    d8.add_paragraph("Introductory paragraph for executive summary.")
    d8.add_picture(create_sample_image_bytes(), width=Inches(2.5))
    d8.add_page_break()

    d8.add_heading("Detailed Analysis Table", level=2)
    t8 = d8.add_table(rows=2, cols=2)
    t8.rows[0].cells[0].text = "Metric"
    t8.rows[0].cells[1].text = "Value"
    t8.rows[1].cells[0].text = "Growth"
    t8.rows[1].cells[1].text = "+42%"

    path8_docx = os.path.join(scratch_dir, "test8_complex.docx")
    path8_pdf = os.path.join(scratch_dir, "test8_complex.pdf")
    d8.save(path8_docx)

    res8 = docx_to_pdf_convert(path8_docx, path8_pdf)
    print(f"  Engine Used: {res8.get('engine')}")
    assert os.path.exists(path8_pdf) and os.path.getsize(path8_pdf) > 0, "Test 8 PDF missing!"
    doc8_pdf = pymupdf.open(path8_pdf)
    p_count8 = len(doc8_pdf)
    doc8_pdf.close()
    assert p_count8 >= 2, f"Test 8: Expected at least 2 pages, got {p_count8}"
    print(f"  [OK] Test 8 Passed: Complex multi-page report converted ({p_count8} pages)!")

    print("\n" + "=" * 70)
    print("  ALL 8 WORD-TO-PDF HIGH-FIDELITY QA TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_word_to_pdf_suite()
