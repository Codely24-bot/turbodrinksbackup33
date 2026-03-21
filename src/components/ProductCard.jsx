import { memo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";

function ProductCard({ product, quantity, onAdd, onIncrease, onDecrease, priority = "lazy" }) {
  const displayPrice = Number(product?.price ?? 0);
  const comparePrice = Number(product?.originalPrice ?? displayPrice);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <article className="product-card">
      <div className={`product-art ${imageLoaded || imageError ? "is-ready" : "is-loading"}`}>
        <img
          src={product.image}
          alt={product.name}
          loading={priority}
          decoding="async"
          fetchPriority={priority === "eager" ? "high" : "low"}
          width="120"
          height="120"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
        {product.badge ? <span className="product-badge">{product.badge}</span> : null}
      </div>

      <div className="product-copy">
        <div className="product-meta">
          <span className="product-volume">{product.volume}</span>
          <span className="product-category">{product.category}</span>
        </div>

        <h3>{product.name}</h3>
        <p>{product.description}</p>

        <div className="product-footer">
          <div>
            <strong>R$ {displayPrice.toFixed(2).replace(".", ",")}</strong>
            {comparePrice > displayPrice ? (
              <span>R$ {comparePrice.toFixed(2).replace(".", ",")}</span>
            ) : null}
          </div>

          {quantity > 0 ? (
            <div className="stepper">
              <button type="button" onClick={onDecrease} aria-label={`Remover ${product.name}`}>
                <Minus size={16} />
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={onIncrease} aria-label={`Adicionar ${product.name}`}>
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className="button button-primary" onClick={onAdd}>
              <ShoppingBag size={16} />
              Adicionar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default memo(ProductCard);
