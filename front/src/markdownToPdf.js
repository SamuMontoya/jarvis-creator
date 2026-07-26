const MARGIN = 20;
const LINE_HEIGHT = 7;

const STYLES = [
  { prefix: '# ', size: 20, weight: 'bold', spacing: 1.5 },
  { prefix: '## ', size: 16, weight: 'bold', spacing: 1.2 },
  { prefix: '### ', size: 12, weight: 'bold', spacing: 1 },
  { prefix: '- ', size: 11, weight: 'normal', spacing: 1 },
  { prefix: '*', size: 10, weight: 'italic', spacing: 1 },
];

const BODY_STYLE = { size: 11, weight: 'normal', spacing: 1 };

const styleFor = (line) =>
  STYLES.find(({ prefix }) => line.startsWith(prefix)) ?? BODY_STYLE;

// jsPDF is ~350kB; loading it only when a PDF is actually requested keeps it
// out of the initial bundle.
export async function markdownToPdf(markdown) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - 2 * MARGIN;

  let y = MARGIN;

  for (const line of markdown.split('\n')) {
    if (y > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }

    if (line.trim() === '---') {
      y += 5;
      doc.setDrawColor(200);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 10;
      continue;
    }

    if (line.trim() === '') {
      y += LINE_HEIGHT * 0.5;
      continue;
    }

    const style = styleFor(line);
    const text = style.prefix ? line.slice(style.prefix.length) : line;

    doc.setFontSize(style.size);
    doc.setFont('helvetica', style.weight);

    const wrapped = doc.splitTextToSize(text, maxWidth);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * LINE_HEIGHT * style.spacing;
  }

  return doc;
}
