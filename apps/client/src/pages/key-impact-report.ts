export type KeyImpactEntry = {
  category: string;
  percentage: number;
  question: string;
};

export const keyImpactColors = [
  "#7c3aed",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#ddd6fe",
  "#ede9fe",
];

export const keyImpactDescription =
  "This report identifies key motivators of employee engagement within your unique population. This information is vital to knowing what workplace attributes are most important to retain your top talent and drive high productivity among all staff.";

const rgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

export async function downloadKeyImpactPdf(
  entries: KeyImpactEntry[],
  organizationName: string,
  year: number | undefined,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "legal", unit: "mm" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const gap = 3;
  const cellWidth = (pageWidth - margin * 2 - gap) / 2;
  const bottomLimit = pageHeight - 18;

  const addPage = (first: boolean) => {
    if (!first) pdf.addPage();
    pdf.setFillColor(245, 245, 245);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    pdf.setFillColor(22, 38, 48);
    pdf.rect(0, 0, pageWidth, 20, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text("WORKFORCE RESEARCH GROUP", margin, 11);
    const organization = organizationName.toUpperCase();
    let headerName = organization;
    let headerLength = organization.length;
    while (pdf.getTextWidth(headerName) > pageWidth / 2 - margin && headerLength > 0) {
      headerLength -= 1;
      headerName = `${organization.slice(0, headerLength)}...`;
    }
    pdf.text(headerName, pageWidth - margin, 8, {
      align: "right",
    });
    pdf.setFont("helvetica", "normal");
    pdf.text(new Date().toLocaleDateString("en-GB"), pageWidth - margin, 15, {
      align: "right",
    });
    pdf.setTextColor(29, 33, 36);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("KEY IMPACT ANALYSIS", margin, 35);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(94, 100, 106);
    const descriptionLines = pdf.splitTextToSize(
      keyImpactDescription,
      pageWidth - margin * 2,
    ) as string[];
    pdf.text(descriptionLines, margin, 43);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(29, 33, 36);
    pdf.text("KEY MOTIVATORS", margin, 65);
  };

  addPage(true);
  let rowY = 70;
  for (let index = 0; index < entries.length; index += 2) {
    const pair = entries.slice(index, index + 2);
    const layouts = pair.map((entry) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      const description = pdf.splitTextToSize(entry.question, cellWidth - 8) as string[];
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      const category = pdf.splitTextToSize(entry.category, cellWidth - 8) as string[];
      return { entry, description, category };
    });
    const rowHeight = Math.max(
      45,
      ...layouts.map(({ category, description }) =>
        31 + category.length * 5 + description.length * 4.5,
      ),
    );
    if (rowY + rowHeight > bottomLimit) {
      addPage(false);
      rowY = 70;
    }
    layouts.forEach(({ entry, description, category }, column) => {
      const x = margin + column * (cellWidth + gap);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(x, rowY, cellWidth, rowHeight, "F");
      const [red, green, blue] = rgb(
        keyImpactColors[(index + column) % keyImpactColors.length] ?? "#7c3aed",
      );
      pdf.setFillColor(red, green, blue);
      pdf.circle(x + 12, rowY + 12, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(29, 33, 36);
      pdf.text(`${entry.percentage.toFixed(1)}%`, x + 12, rowY + 13, {
        align: "center",
      });
      pdf.setFontSize(11);
      pdf.text(category, x + 4, rowY + 27);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.text(description, x + 4, rowY + 27 + category.length * 5 + 1);
    });
    rowY += rowHeight + 5;
  }
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(10);
  pdf.setTextColor(29, 33, 36);
  pdf.text("Note: all points have a significant impact on the results", margin, pageHeight - margin);
  pdf.save(`Key_Impact_Analysis_${year ?? "report"}.pdf`);
}
