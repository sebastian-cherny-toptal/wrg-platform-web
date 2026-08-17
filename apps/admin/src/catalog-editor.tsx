import { BarChart3, MessageSquareText, PackageCheck } from "lucide-react";
import type { ReportProduct } from "./api";

const productIcons = {
  "report-verbatims-sorted": MessageSquareText,
  "report-kia": BarChart3,
  "report-resort": PackageCheck,
} as const;

export function CatalogEditor({ products, onChange }: { products: ReportProduct[]; onChange: (products: ReportProduct[]) => void }) {
  const update = (id: string, patch: Partial<ReportProduct>) =>
    onChange(products.map((product) => product.id === id ? { ...product, ...patch } : product));
  return (
    <div className="catalog-editor">
      <p className="modal-copy">Choose which optional reports clients can see. Prices are shown in US dollars; Custom Report Re-sort remains contact-only.</p>
      <div className="catalog-product-grid">
        {products.map((product) => {
          const Icon = productIcons[product.id as keyof typeof productIcons] ?? BarChart3;
          const contactOnly = product.id === "report-resort";
          return (
            <article className={product.available ? "catalog-product selected" : "catalog-product"} key={product.id}>
              <div className="catalog-product-heading">
                <span className="catalog-product-icon"><Icon size={22} /></span>
                <label className="catalog-toggle">
                  <input type="checkbox" checked={product.available} onChange={(event) => update(product.id, { available: event.target.checked })} />
                  <span>{product.available ? "Offered" : "Not offered"}</span>
                </label>
              </div>
              <label>Product name<input value={product.name} maxLength={120} onChange={(event) => update(product.id, { name: event.target.value })} /></label>
              <label>Description<textarea value={product.description} maxLength={500} rows={3} onChange={(event) => update(product.id, { description: event.target.value })} /></label>
              {contactOnly ? <p className="catalog-contact-note">Contact a Survey Professional — no online price or checkout button.</p> : (
                <label>Price (USD)<div className="money-input"><span>$</span><input type="number" min="0" step="0.01" value={(product.priceCents / 100).toFixed(2)} onChange={(event) => update(product.id, { priceCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })} /></div></label>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
