import{a as e,i as t,n,r,t as i}from"./rotate-ccw-BlXwO4UN.js";import{t as a}from"./circle-check-BaFobnNg.js";import{t as o}from"./info-nlpt_Otm.js";import{t as s}from"./palette-B2sGkyiU.js";import{t as c}from"./sliders-vertical-Dy5YwCm6.js";import{t as l}from"./upload-BHVOYagN.js";import{C as u,_ as d,g as f,n as p,o as m,w as h}from"./index-DIFD3WOF.js";import{t as g}from"./api-fx7QNCGJ.js";var _={name:`code`,size:24,node:[[`path`,{d:`m16 18 6-6-6-6`,key:`eg8j8`}],[`path`,{d:`m8 6-6 6 6 6`,key:`ppft3o`}]]};_.node;var v=u(_),y={name:`file-code`,size:24,node:[[`path`,{d:`M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,key:`1oefj6`}],[`path`,{d:`M14 2v5a1 1 0 0 0 1 1h5`,key:`wfsgrz`}],[`path`,{d:`M10 12.5 8 15l2 2.5`,key:`1tg20x`}],[`path`,{d:`m14 12.5 2 2.5-2 2.5`,key:`yinavb`}]]};y.node;var b=u(y),x=h(),S=p(),C=e=>e<1024?`${e} B`:e<1048576?`${(e/1024).toFixed(1)} KB`:`${(e/1048576).toFixed(2)} MB`,w=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sample Invoice & Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px;
      color: #1e293b;
      background: #f8fafc;
    }
    .header-card {
      background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 10px 15px -3px rgba(180, 83, 9, 0.2);
    }
    .header-card h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
      font-weight: 800;
    }
    .header-card p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .stat-title {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      background: #fef3c7;
      color: #b45309;
    }
  </style>
</head>
<body>
  <div class="header-card">
    <h1>Quarterly Performance Report</h1>
    <p>Generated dynamically using GlowPDF Real Browser Engine</p>
  </div>

  <div class="grid-stats">
    <div class="stat-card">
      <div class="stat-title">Fidelity</div>
      <div class="stat-value">100% Native</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Engine</div>
      <div class="stat-value">Chromium</div>
    </div>
    <div class="stat-card">
      <div class="stat-title">Visual CSS</div>
      <div class="stat-value">Full Support</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Document Element</th>
        <th>Visual Quality</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Gradients &amp; Shadows</td>
        <td>High-Fidelity CSS3 Rendering</td>
        <td><span class="badge">Preserved</span></td>
      </tr>
      <tr>
        <td>Tables &amp; Layouts</td>
        <td>Exact Grid / Flex Alignment</td>
        <td><span class="badge">Preserved</span></td>
      </tr>
      <tr>
        <td>Typography &amp; Fonts</td>
        <td>Standardized Print DPI</td>
        <td><span class="badge">Active</span></td>
      </tr>
    </tbody>
  </table>
</body>
</html>`,T=({onBack:u})=>{let[p,h]=(0,x.useState)(`file`),[_,y]=(0,x.useState)(null),[T,E]=(0,x.useState)(``),[D,O]=(0,x.useState)(``),[k,A]=(0,x.useState)(`a4`),[j,M]=(0,x.useState)(`portrait`),[N,P]=(0,x.useState)(`normal`),[F,I]=(0,x.useState)(!0),[L,R]=(0,x.useState)(!1),[z,B]=(0,x.useState)(``),[V,H]=(0,x.useState)(null),[U,W]=(0,x.useState)(null),[G,K]=(0,x.useState)(!1),q=(0,x.useRef)(null),J=e=>{if(W(null),H(null),!(e.name.toLowerCase().endsWith(`.html`)||e.name.toLowerCase().endsWith(`.htm`)||e.type===`text/html`)){W(`Only HTML (.html, .htm) files are supported. Please choose a valid HTML file.`);return}if(e.size===0){W(`The selected HTML file is empty.`);return}y(e)};return(0,S.jsx)(`div`,{className:`pdf-to-word-page`,children:(0,S.jsxs)(`div`,{className:`container`,children:[(0,S.jsxs)(`div`,{className:`tool-top-bar`,children:[(0,S.jsxs)(`button`,{type:`button`,className:`tool-back-btn`,onClick:u,"aria-label":`Back to all tools`,children:[(0,S.jsx)(e,{size:16}),(0,S.jsx)(`span`,{children:`All Tools`})]}),(0,S.jsx)(`div`,{className:`tool-badge-pill`,style:{backgroundColor:`#fef3c7`,color:`#b45309`},children:`HTML to PDF`})]}),(0,S.jsxs)(`div`,{className:`tool-main-header`,children:[(0,S.jsx)(`h1`,{className:`tool-main-title`,children:`Convert HTML to PDF`}),(0,S.jsx)(`p`,{className:`tool-main-subtitle`,children:`Convert HTML documents, CSS styling, tables, and web graphics into standardized, high-fidelity PDF documents using a real browser rendering engine.`})]}),U&&(0,S.jsxs)(`div`,{className:`tool-alert-banner error`,role:`alert`,children:[(0,S.jsx)(t,{size:18,className:`tool-alert-icon`}),(0,S.jsx)(`span`,{children:U})]}),(0,S.jsx)(`input`,{type:`file`,ref:q,onChange:e=>{e.target.files&&e.target.files.length>0&&(J(e.target.files[0]),e.target.value=``)},accept:`.html,.htm,text/html`,style:{display:`none`},id:`html-to-pdf-input`}),V?(0,S.jsxs)(`div`,{className:`merge-result-card`,children:[(0,S.jsx)(`div`,{className:`result-icon-box`,style:{backgroundColor:`#fef3c7`},children:(0,S.jsx)(a,{size:36,color:`#b45309`})}),(0,S.jsx)(`h2`,{className:`result-title`,children:`HTML converted to PDF successfully!`}),(0,S.jsx)(`p`,{className:`result-desc`,children:`Your HTML page and CSS styling have been rendered with visual fidelity and exported as a standardized PDF.`}),(0,S.jsxs)(`div`,{className:`word-features-badges`,children:[(0,S.jsxs)(`span`,{className:`word-feature-badge`,children:[(0,S.jsx)(f,{size:14}),(0,S.jsx)(`span`,{children:`Real Chromium Browser Engine`})]}),(0,S.jsxs)(`span`,{className:`word-feature-badge`,children:[(0,S.jsx)(m,{size:14}),(0,S.jsx)(`span`,{children:`CSS3 Layout, Colors & Fonts Preserved`})]}),(0,S.jsxs)(`span`,{className:`word-feature-badge`,children:[(0,S.jsx)(s,{size:14}),(0,S.jsx)(`span`,{children:`Gradients & Background Graphics Retained`})]})]}),(0,S.jsxs)(`div`,{className:`word-stats-card`,children:[(0,S.jsxs)(`div`,{className:`word-stat-item`,children:[(0,S.jsx)(`span`,{className:`word-stat-label`,children:`Output File`}),(0,S.jsx)(`span`,{className:`word-stat-value`,title:V.downloadName,children:V.downloadName})]}),(0,S.jsxs)(`div`,{className:`word-stat-item`,children:[(0,S.jsx)(`span`,{className:`word-stat-label`,children:`PDF Size`}),(0,S.jsx)(`span`,{className:`word-stat-value`,children:C(V.pdfBytes)})]}),(0,S.jsxs)(`div`,{className:`word-stat-item`,children:[(0,S.jsx)(`span`,{className:`word-stat-label`,children:`Page Count`}),(0,S.jsx)(`span`,{className:`word-stat-value`,children:V.pageCount})]}),(0,S.jsxs)(`div`,{className:`word-stat-item`,children:[(0,S.jsx)(`span`,{className:`word-stat-label`,children:`Format`}),(0,S.jsxs)(`span`,{className:`word-stat-value`,style:{textTransform:`uppercase`},children:[k,` • `,j]})]})]}),(0,S.jsxs)(`div`,{className:`word-info-banner`,children:[(0,S.jsx)(o,{size:16,style:{flexShrink:0,color:`#b45309`}}),(0,S.jsx)(`span`,{children:`100% private: Processed temporarily in memory and deleted immediately. No user files or documents are retained.`})]}),(0,S.jsxs)(`div`,{className:`result-actions-wrapper`,children:[(0,S.jsxs)(`button`,{type:`button`,className:`btn-download-primary`,onClick:()=>{if(!V)return;let e=document.createElement(`a`);e.href=V.url,e.download=V.downloadName||`glowpdf_html_to_pdf.pdf`,document.body.appendChild(e),e.click(),document.body.removeChild(e)},style:{backgroundColor:`#b45309`},children:[(0,S.jsx)(r,{size:20}),(0,S.jsx)(`span`,{children:`Download PDF File`})]}),(0,S.jsxs)(`button`,{type:`button`,className:`btn-restart-action`,onClick:()=>{V&&V.url&&URL.revokeObjectURL(V.url),y(null),E(``),H(null),W(null)},children:[(0,S.jsx)(i,{size:16}),(0,S.jsx)(`span`,{children:`Convert Another HTML Document`})]})]})]}):(0,S.jsxs)(`div`,{className:`word-workspace-card`,style:{maxWidth:`840px`,margin:`0 auto`},children:[(0,S.jsxs)(`div`,{style:{display:`flex`,gap:`8px`,padding:`6px`,background:`#f1f5f9`,borderRadius:`10px`,marginBottom:`20px`},children:[(0,S.jsxs)(`button`,{type:`button`,onClick:()=>{h(`file`),W(null)},style:{flex:1,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`,padding:`10px 16px`,borderRadius:`8px`,border:`none`,fontSize:`14px`,fontWeight:600,cursor:`pointer`,transition:`all 0.2s ease`,backgroundColor:p===`file`?`#ffffff`:`transparent`,color:p===`file`?`#b45309`:`#64748b`,boxShadow:p===`file`?`0 2px 4px rgba(0,0,0,0.06)`:`none`},children:[(0,S.jsx)(l,{size:16}),(0,S.jsx)(`span`,{children:`Upload HTML File`})]}),(0,S.jsxs)(`button`,{type:`button`,onClick:()=>{h(`code`),W(null)},style:{flex:1,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`,padding:`10px 16px`,borderRadius:`8px`,border:`none`,fontSize:`14px`,fontWeight:600,cursor:`pointer`,transition:`all 0.2s ease`,backgroundColor:p===`code`?`#ffffff`:`transparent`,color:p===`code`?`#b45309`:`#64748b`,boxShadow:p===`code`?`0 2px 4px rgba(0,0,0,0.06)`:`none`},children:[(0,S.jsx)(v,{size:16}),(0,S.jsx)(`span`,{children:`Direct HTML Code`})]}),(0,S.jsxs)(`button`,{type:`button`,onClick:()=>{h(`url`),W(null)},style:{flex:1,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`,padding:`10px 16px`,borderRadius:`8px`,border:`none`,fontSize:`14px`,fontWeight:600,cursor:`pointer`,transition:`all 0.2s ease`,backgroundColor:p===`url`?`#ffffff`:`transparent`,color:p===`url`?`#b45309`:`#64748b`,boxShadow:p===`url`?`0 2px 4px rgba(0,0,0,0.06)`:`none`},children:[(0,S.jsx)(f,{size:16}),(0,S.jsx)(`span`,{children:`Webpage URL`})]})]}),p===`file`?_?(0,S.jsxs)(`div`,{className:`split-file-header-card`,style:{marginBottom:`20px`},children:[(0,S.jsx)(`div`,{className:`split-file-icon-box`,style:{backgroundColor:`#fef3c7`,color:`#b45309`},children:(0,S.jsx)(b,{size:28})}),(0,S.jsxs)(`div`,{className:`split-file-meta`,children:[(0,S.jsx)(`h3`,{className:`split-file-name`,title:_.name,children:_.name}),(0,S.jsxs)(`div`,{className:`split-file-details`,children:[(0,S.jsx)(`span`,{children:C(_.size)}),(0,S.jsx)(`span`,{children:`•`}),(0,S.jsx)(`span`,{className:`word-page-count-badge`,style:{backgroundColor:`#fef3c7`,color:`#b45309`},children:`HTML Document`})]})]}),(0,S.jsx)(`button`,{type:`button`,className:`btn-change-file`,onClick:()=>y(null),title:`Choose a different file`,children:`Change`})]}):(0,S.jsxs)(`div`,{className:`file-upload-dropzone ${G?`dragging-over`:``}`,onDrop:e=>{e.preventDefault(),K(!1),e.dataTransfer.files&&e.dataTransfer.files.length>0&&J(e.dataTransfer.files[0])},onDragOver:e=>{e.preventDefault(),K(!0)},onDragLeave:e=>{e.preventDefault(),K(!1)},onClick:()=>q.current?.click(),role:`button`,tabIndex:0,"aria-label":`Upload HTML file`,style:{minHeight:`220px`,padding:`30px 20px`,border:`2px dashed #cbd5e1`,borderRadius:`12px`},onKeyDown:e=>{(e.key===`Enter`||e.key===` `)&&q.current?.click()},children:[(0,S.jsx)(`div`,{className:`upload-icon-wrapper`,style:{backgroundColor:`#fef3c7`,color:`#b45309`,margin:`0 auto 16px`},children:(0,S.jsx)(b,{size:36})}),(0,S.jsx)(`h2`,{className:`upload-main-text`,style:{fontSize:`18px`,fontWeight:700,margin:`0 0 6px 0`},children:`Choose HTML (.html) File`}),(0,S.jsx)(`p`,{className:`upload-sub-text`,style:{fontSize:`13px`,color:`#64748b`,margin:`0 0 16px 0`},children:`or drag & drop your HTML file here`}),(0,S.jsxs)(`button`,{type:`button`,className:`btn-select-files`,style:{backgroundColor:`#b45309`,color:`#ffffff`,padding:`10px 22px`,borderRadius:`8px`,fontWeight:600,border:`none`,cursor:`pointer`,display:`inline-flex`,alignItems:`center`,gap:`8px`},onClick:e=>{e.stopPropagation(),q.current?.click()},children:[(0,S.jsx)(d,{size:18}),(0,S.jsx)(`span`,{children:`Select HTML Document`})]})]}):p===`code`?(0,S.jsxs)(`div`,{style:{marginBottom:`20px`},children:[(0,S.jsxs)(`div`,{style:{display:`flex`,justifyContent:`space-between`,alignItems:`center`,marginBottom:`8px`},children:[(0,S.jsx)(`label`,{htmlFor:`html-code-textarea`,style:{fontSize:`13px`,fontWeight:600,color:`#334155`},children:`Paste or Type HTML / CSS Code:`}),(0,S.jsxs)(`button`,{type:`button`,onClick:()=>{E(w),W(null)},style:{background:`none`,border:`none`,color:`#b45309`,fontSize:`12px`,fontWeight:600,cursor:`pointer`,display:`inline-flex`,alignItems:`center`,gap:`4px`},children:[(0,S.jsx)(m,{size:13}),(0,S.jsx)(`span`,{children:`Load Sample Template`})]})]}),(0,S.jsx)(`textarea`,{id:`html-code-textarea`,value:T,onChange:e=>E(e.target.value),placeholder:`<!DOCTYPE html><html><head><style>...</style></head><body><h1>Hello World</h1></body></html>`,rows:9,style:{width:`100%`,fontFamily:`Consolas, Monaco, "Courier New", monospace`,fontSize:`13px`,lineHeight:`1.5`,padding:`14px`,borderRadius:`8px`,border:`1px solid #cbd5e1`,color:`#0f172a`,backgroundColor:`#f8fafc`,resize:`vertical`,boxSizing:`border-box`},spellCheck:!1}),(0,S.jsxs)(`div`,{style:{fontSize:`11px`,color:`#64748b`,marginTop:`4px`,textAlign:`right`},children:[T.length,` characters • `,T.split(`
`).length,` lines`]})]}):(0,S.jsxs)(`div`,{style:{marginBottom:`20px`},children:[(0,S.jsx)(`label`,{htmlFor:`webpage-url-input`,style:{display:`block`,fontSize:`13px`,fontWeight:600,color:`#334155`,marginBottom:`8px`},children:`Enter Webpage URL (http:// or https://):`}),(0,S.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`8px`},children:[(0,S.jsxs)(`div`,{style:{position:`relative`,flex:1},children:[(0,S.jsx)(f,{size:18,style:{position:`absolute`,left:`12px`,top:`50%`,transform:`translateY(-50%)`,color:`#94a3b8`}}),(0,S.jsx)(`input`,{id:`webpage-url-input`,type:`url`,value:D,onChange:e=>O(e.target.value),placeholder:`https://en.wikipedia.org/wiki/PDF`,style:{width:`100%`,padding:`10px 12px 10px 38px`,borderRadius:`8px`,border:`1px solid #cbd5e1`,fontSize:`14px`,color:`#0f172a`,backgroundColor:`#ffffff`,boxSizing:`border-box`}})]}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>O(`https://en.wikipedia.org/wiki/PDF`),style:{padding:`10px 14px`,borderRadius:`8px`,border:`1px solid #e2e8f0`,backgroundColor:`#f8fafc`,color:`#b45309`,fontSize:`12px`,fontWeight:600,cursor:`pointer`,whiteSpace:`nowrap`},children:`Load Sample URL`})]})]}),(0,S.jsxs)(`div`,{style:{background:`#f8fafc`,border:`1px solid #e2e8f0`,borderRadius:`10px`,padding:`16px`,marginBottom:`20px`},children:[(0,S.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:`8px`,marginBottom:`14px`},children:[(0,S.jsx)(c,{size:16,color:`#b45309`}),(0,S.jsx)(`span`,{style:{fontSize:`13px`,fontWeight:700,color:`#1e293b`},children:`PDF Page Settings`})]}),(0,S.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`repeat(auto-fit, minmax(180px, 1fr))`,gap:`14px`},children:[(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{htmlFor:`html-pdf-page-size`,style:{display:`block`,fontSize:`12px`,fontWeight:600,color:`#475569`,marginBottom:`6px`},children:`Page Size`}),(0,S.jsxs)(`select`,{id:`html-pdf-page-size`,value:k,onChange:e=>A(e.target.value),style:{width:`100%`,padding:`8px 10px`,borderRadius:`6px`,border:`1px solid #cbd5e1`,backgroundColor:`#ffffff`,fontSize:`13px`,fontWeight:500,color:`#1e293b`},children:[(0,S.jsx)(`option`,{value:`a4`,children:`A4 (Standard 210 × 297 mm)`}),(0,S.jsx)(`option`,{value:`letter`,children:`US Letter (8.5 × 11 in)`})]})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{htmlFor:`html-pdf-orientation`,style:{display:`block`,fontSize:`12px`,fontWeight:600,color:`#475569`,marginBottom:`6px`},children:`Orientation`}),(0,S.jsxs)(`select`,{id:`html-pdf-orientation`,value:j,onChange:e=>M(e.target.value),style:{width:`100%`,padding:`8px 10px`,borderRadius:`6px`,border:`1px solid #cbd5e1`,backgroundColor:`#ffffff`,fontSize:`13px`,fontWeight:500,color:`#1e293b`},children:[(0,S.jsx)(`option`,{value:`portrait`,children:`Portrait`}),(0,S.jsx)(`option`,{value:`landscape`,children:`Landscape`})]})]}),(0,S.jsxs)(`div`,{children:[(0,S.jsx)(`label`,{htmlFor:`html-pdf-margins`,style:{display:`block`,fontSize:`12px`,fontWeight:600,color:`#475569`,marginBottom:`6px`},children:`Margins`}),(0,S.jsxs)(`select`,{id:`html-pdf-margins`,value:N,onChange:e=>P(e.target.value),style:{width:`100%`,padding:`8px 10px`,borderRadius:`6px`,border:`1px solid #cbd5e1`,backgroundColor:`#ffffff`,fontSize:`13px`,fontWeight:500,color:`#1e293b`},children:[(0,S.jsx)(`option`,{value:`normal`,children:`Normal (15 mm)`}),(0,S.jsx)(`option`,{value:`small`,children:`Small (6 mm)`}),(0,S.jsx)(`option`,{value:`none`,children:`None (0 mm)`})]})]}),(0,S.jsx)(`div`,{style:{display:`flex`,alignItems:`flex-end`},children:(0,S.jsxs)(`label`,{style:{display:`flex`,alignItems:`center`,gap:`8px`,fontSize:`13px`,fontWeight:500,color:`#334155`,cursor:`pointer`,paddingBottom:`8px`},children:[(0,S.jsx)(`input`,{type:`checkbox`,checked:F,onChange:e=>I(e.target.checked),style:{width:`16px`,height:`16px`,accentColor:`#b45309`}}),(0,S.jsx)(`span`,{children:`Background Graphics`})]})})]})]}),(0,S.jsx)(`button`,{type:`button`,className:`btn-word-action`,style:{backgroundColor:`#b45309`,boxShadow:`0 4px 14px rgba(180, 83, 9, 0.35)`,color:`#ffffff`,width:`100%`,padding:`14px 20px`,borderRadius:`8px`,fontSize:`15px`,fontWeight:700,border:`none`,cursor:p===`file`&&!_||p===`code`&&!T.trim()||p===`url`&&!D.trim()||L?`not-allowed`:`pointer`,opacity:p===`file`&&!_||p===`code`&&!T.trim()||p===`url`&&!D.trim()||L?.7:1,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`},onClick:async()=>{if(p!==`file`||_){if(p===`code`&&!T.trim()){W(`Please enter some HTML code or load the sample template.`);return}if(p===`url`&&!D.trim()){W(`Please enter a website URL to convert.`);return}R(!0),W(null),B(p===`url`?`Fetching webpage and launching Chromium...`:`Submitting HTML to Chromium rendering engine...`);try{let e=new FormData;p===`file`&&_?e.append(`file`,_):p===`code`?e.append(`html_text`,T):p===`url`&&e.append(`url`,D.trim()),e.append(`page_size`,k),e.append(`orientation`,j),e.append(`margin`,N),e.append(`print_background`,F?`true`:`false`),B(`Rendering CSS layout, typography & visual styling...`);let t=await g(`/api/convert-html-to-pdf`,{method:`POST`,body:e});if(!t.ok){let e=`Conversion failed.`;try{let n=await t.json();n&&n.detail&&(e=n.detail)}catch{e=`Server error (${t.status}: ${t.statusText})`}throw Error(e)}B(`Generating standardized, print-grade PDF document...`);let n=await t.blob(),r=URL.createObjectURL(n),i=(t.headers.get(`Content-Disposition`)||``).match(/filename="?([^";]+)"?/i),a=`glowpdf_html_to_pdf.pdf`;p===`file`&&_&&(a=`${_.name.replace(/\.html?$/i,``)}.pdf`);let o=i?i[1]:a,s=t.headers.get(`X-Total-Pages`),c=s?parseInt(s,10):1,l=t.headers.get(`X-Engine`)||`chromium`;H({url:r,downloadName:o,pdfBytes:n.size,originalBytes:_?_.size:new Blob([T]).size,pageCount:c,engine:l})}catch(e){W(e instanceof Error?e.message:`An unexpected error occurred during HTML to PDF conversion.`)}finally{R(!1),B(``)}}},disabled:p===`file`&&!_||p===`code`&&!T.trim()||p===`url`&&!D.trim()||L,children:L?(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(n,{size:20,className:`spinner-icon`}),(0,S.jsx)(`span`,{children:z||`Converting HTML to PDF...`})]}):(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(f,{size:20}),(0,S.jsx)(`span`,{children:`Convert to PDF`})]})})]})]})})};export{T as HtmlToPdf,T as default};