import { Minus, Plus, ShoppingBag } from "lucide-react";

function ProductCard({ product, quantity, onAdd, onIncrease, onDecrease }) {
  return (
    <article className="product-card">
      <div className="product-art">
        <img src={product.image} alt={product.name} />
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
            <strong>R$ {product.salePrice.toFixed(2).replace(".", ",")}</strong>
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

export default ProductCard;
