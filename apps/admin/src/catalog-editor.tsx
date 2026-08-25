import { BarChart3, MessageSquareText, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportProduct } from "./api";

const productIcons = {
  "report-verbatims-sorted": MessageSquareText,
  "report-kia": BarChart3,
  "report-resort": PackageCheck,
} as const;

export function MoneyInput({
  priceCents,
  onChange,
  ariaLabel,
}: {
  priceCents: number;
  onChange: (priceCents: number) => void;
  ariaLabel?: string;
}) {
  const [value, setValue] = useState((priceCents / 100).toFixed(2));

  useEffect(() => setValue((priceCents / 100).toFixed(2)), [priceCents]);

  const commit = () => {
    const amount = Number(value.replaceAll(",", "").trim());
    const nextPrice = Number.isFinite(amount)
      ? Math.max(0, Math.round(amount * 100))
      : priceCents;
    onChange(nextPrice);
    setValue((nextPrice / 100).toFixed(2));
  };

  return (
    <div className="money-input">
      <span>$</span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        min="0"
        onBlur={commit}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        type="text"
        value={value}
      />
    </div>
  );
}

export function CatalogEditor({
  products,
  onChange,
}: {
  products: ReportProduct[];
  onChange: (products: ReportProduct[]) => void;
}) {
  const update = (id: string, patch: Partial<ReportProduct>) =>
    onChange(
      products.map((product) =>
        product.id === id ? { ...product, ...patch } : product,
      ),
    );
  return (
    <div className="catalog-editor">
      <p className="modal-copy">
        Choose which optional reports clients can see. Prices are shown in US
        dollars; Custom Report Re-sort remains contact-only.
      </p>
      <div className="catalog-product-grid">
        {products.map((product) => {
          const Icon =
            productIcons[product.id as keyof typeof productIcons] ?? BarChart3;
          const contactOnly = product.id === "report-resort";
          return (
            <article
              className={
                product.available
                  ? "catalog-product selected"
                  : "catalog-product"
              }
              key={product.id}
            >
              <div className="catalog-product-heading">
                <span className="catalog-product-icon">
                  <Icon size={22} />
                </span>
                <label className="catalog-toggle">
                  <input
                    type="checkbox"
                    checked={product.available}
                    onChange={(event) =>
                      update(product.id, { available: event.target.checked })
                    }
                  />
                  <span>{product.available ? "Offered" : "Not offered"}</span>
                </label>
              </div>
              <label>
                Product name
                <input
                  value={product.name}
                  maxLength={120}
                  onChange={(event) =>
                    update(product.id, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  value={product.description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) =>
                    update(product.id, { description: event.target.value })
                  }
                />
              </label>
              {contactOnly ? (
                <p className="catalog-contact-note">
                  Contact a Survey Professional — no online price or checkout
                  button.
                </p>
              ) : (
                <label>
                  Price (USD)
                  <MoneyInput
                    priceCents={product.priceCents}
                    onChange={(priceCents) =>
                      update(product.id, { priceCents })
                    }
                  />
                </label>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
