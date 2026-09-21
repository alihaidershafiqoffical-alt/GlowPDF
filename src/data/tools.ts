import type { ToolItem } from '../types/tool';

export const COMPLETED_TOOLS: string[] = [
  'edit-pdf',
  'merge-pdf',
  'split-pdf',
  'compress-pdf',
  'pdf-to-word',
  'pdf-to-powerpoint',
  'powerpoint-to-pdf',
  'pdf-to-excel',
  'excel-to-pdf',
  'pdf-to-jpg',
  'jpg-to-pdf',
  'word-to-pdf',
  'html-to-pdf',
  'watermark-pdf',
  'protect-pdf',
  'unlock-pdf',
  'rotate-pdf',
  'delete-pages',
  'pdf-to-pdfa'
];

export const TOOLS_DATA: ToolItem[] = [
  {
    id: 'edit-pdf',
    name: 'PDF Editor',
    description: 'Edit PDF text, add shapes, drawings, images, annotations, and permanently redact sensitive data.',
    category: 'organize',
    categoryLabel: 'Edit & Organize',
    iconName: 'FileEdit',
    badgeBg: '#e0f2fe',
    iconColor: '#0284c7'
  },
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF files into one single unified document in your preferred order.',
    category: 'organize',
    categoryLabel: 'Organize',
    iconName: 'Files',
    badgeBg: '#fee2e2',
    iconColor: '#dc2626'
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    description: 'Separate one page or an entire set of pages for easy conversion into independent PDF files.',
    category: 'organize',
    categoryLabel: 'Organize',
    iconName: 'Scissors',
    badgeBg: '#fef3c7',
    iconColor: '#d97706'
  },
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    description: 'Reduce PDF file size while optimizing for maximal visual clarity and compact sharing.',
    category: 'optimize',
    categoryLabel: 'Optimize',
    iconName: 'Minimize2',
    badgeBg: '#dcfce7',
    iconColor: '#16a34a'
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    description: 'Convert PDF documents into editable Microsoft Word DOCX documents with preserved formatting.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'FileText',
    badgeBg: '#dbeafe',
    iconColor: '#2563eb'
  },
  {
    id: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    description: 'Convert PDF documents into editable Microsoft PowerPoint (.pptx) presentations with preserved layouts.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'Presentation',
    badgeBg: '#ffedd5',
    iconColor: '#ea580c'
  },
  {
    id: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    description: 'Convert Microsoft PowerPoint presentations into high-grade standardized PDF documents with formatting preserved.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'Presentation',
    badgeBg: '#ffedd5',
    iconColor: '#ea580c'
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    description: 'Pull tables and financial data from PDF documents into editable Microsoft Excel (.xlsx) spreadsheets.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'FileSpreadsheet',
    badgeBg: '#dcfce7',
    iconColor: '#15803d'
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Convert Microsoft Excel spreadsheets into standard PDF documents with tables, sheets, and formatting preserved.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'FileSpreadsheet',
    badgeBg: '#dcfce7',
    iconColor: '#15803d'
  },
  {
    id: 'pdf-to-pdfa',
    name: 'PDF to PDF/A',
    description: 'Convert PDF documents into ISO-compliant archival PDF/A files for long-term storage and compliance.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'Archive',
    badgeBg: '#fef3c7',
    iconColor: '#b45309'
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    description: 'Extract all embedded images or convert each PDF page into high-resolution JPG images.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'Image',
    badgeBg: '#e0e7ff',
    iconColor: '#4f46e5'
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description: 'Transform JPG, PNG, and graphic images into standardized PDF files in seconds.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'FileImage',
    badgeBg: '#fae8ff',
    iconColor: '#c026d3'
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Convert Microsoft Word DOCX documents into high-grade standardized PDF files with formatting preserved.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'FileText',
    badgeBg: '#e0f2fe',
    iconColor: '#0284c7'
  },
  {
    id: 'html-to-pdf',
    name: 'HTML to PDF',
    description: 'Convert web pages, HTML files, or raw HTML/CSS code into high-fidelity PDF documents.',
    category: 'convert',
    categoryLabel: 'Convert',
    iconName: 'Globe',
    badgeBg: '#fef3c7',
    iconColor: '#b45309'
  },
  {
    id: 'watermark-pdf',
    name: 'Watermark PDF',
    description: 'Stamp custom text or image watermarks across your PDF pages with position & opacity control.',
    category: 'security',
    categoryLabel: 'Security',
    iconName: 'Stamp',
    badgeBg: '#f3e8ff',
    iconColor: '#9333ea'
  },
  {
    id: 'protect-pdf',
    name: 'Protect / Lock PDF',
    description: 'Add a robust password and high-grade encryption to prevent unauthorized reading or copying.',
    category: 'security',
    categoryLabel: 'Security',
    iconName: 'Lock',
    badgeBg: '#f1f5f9',
    iconColor: '#334155'
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description: 'Remove password security permissions from your protected PDF documents effortlessly.',
    category: 'security',
    categoryLabel: 'Security',
    iconName: 'Unlock',
    badgeBg: '#ecfdf5',
    iconColor: '#059669'
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description: 'Rotate individual pages or entire documents to perfect portrait or landscape orientation.',
    category: 'organize',
    categoryLabel: 'Organize',
    iconName: 'RotateCw',
    badgeBg: '#ffedd5',
    iconColor: '#ea580c'
  },
  {
    id: 'delete-pages',
    name: 'Delete / Extract Pages',
    description: 'Selectively delete unwanted pages or extract key page ranges into clean new PDF files.',
    category: 'organize',
    categoryLabel: 'Organize',
    iconName: 'Layers',
    badgeBg: '#ccfbf1',
    iconColor: '#0d9488'
  }
];
