import { MapPin, Minus, Plus, TicketPercent, Trash2, Wallet, X } from "lucide-react";

const paymentOptions = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartao na entrega" }
];

function CartDrawer({
  open,
  onClose,
  items,
  onIncrease,
  onDecrease,
  onRemove,
  totals,
  form,
  onFormChange,
  neighborhoods,
  onSubmit,
  submitting
}) {
  return (
    <div className={`cart-shell ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button type="button" className="cart-overlay" onClick={onClose} />

      <aside className="cart-drawer">
        <header className="cart-header">
          <div>
            <span className="eyebrow">Checkout turbo</span>
            <h2>Seu carrinho</h2>
          </div>

          <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar carrinho">
            <X size={18} />
          </button>
        </header>

        <section className="cart-section">
          {items.length ? (
            items.map((item) => (
              <div className="cart-item" key={item.id}>
                <img src={item.image} alt={item.name} />
                <div className="cart-item-copy">
                  <strong>{item.name}</strong>
                  <span>{item.volume}</span>
                  <small>R$ {item.salePrice.toFixed(2).replace(".", ",")}</small>
                </div>

                <div className="cart-actions">
                  <div className="stepper">
                    <button type="button" onClick={() => onDecrease(item.id)}>
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => onIncrease(item.id)}>
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Excluir ${item.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state compact">
              <h3>Carrinho vazio</h3>
              <p>Adicione bebidas, combos e promocoes para continuar.</p>
            </div>
          )}
        </section>

        <section className="cart-section form-block">
          <div className="form-intro">
            <MapPin size={18} />
            <div>
              <strong>Entrega e pagamento</strong>
              <span>Preencha os dados para finalizar o pedido.</span>
            </div>
          </div>

          <div className="field-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => onFormChange("name", event.target.value)}
                placeholder="Seu nome"
              />
            </label>

            <label>
              Telefone
              <input
                value={form.phone}
                onChange={(event) => onFormChange("phone", event.target.value)}
                placeholder="(11) 99999-9999"
              />
            </label>

            <label className="field-span">
              Endereco completo
              <input
                value={form.address}
                onChange={(event) => onFormChange("address", event.target.value)}
                placeholder="Rua, numero e complemento"
              />
            </label>

            <label>
              Bairro
              <select
                value={form.neighborhood}
                onChange={(event) => onFormChange("neighborhood", event.target.value)}
              >
                <option value="">Selecione</option>
                {neighborhoods.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cupom
              <div className="input-with-icon">
                <TicketPercent size={16} />
                <input
                  value={form.couponCode}
                  onChange={(event) => onFormChange("couponCode", event.target.value.toUpperCase())}
                  placeholder="CHEGUEI"
                />
              </div>
            </label>
          </div>

          <div className="payment-grid">
            {paymentOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`payment-card ${form.paymentMethod === option.value ? "is-active" : ""}`}
                onClick={() => onFormChange("paymentMethod", option.value)}
              >
                <Wallet size={16} />
                {option.label}
              </button>
            ))}
          </div>

          {form.paymentMethod === "dinheiro" ? (
            <div className="field-grid">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.needsChange}
                  onChange={(event) => onFormChange("needsChange", event.target.checked)}
                />
                Precisa de troco?
              </label>

              {form.needsChange ? (
                <label className="field-span">
                  Troco para quanto?
                  <input
                    value={form.changeFor}
                    onChange={(event) => onFormChange("changeFor", event.target.value)}
                    placeholder="Ex: 100,00"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <label>
            Observacoes
            <textarea
              rows="3"
              value={form.note}
              onChange={(event) => onFormChange("note", event.target.value)}
              placeholder="Casa azul, apto 203, entregar no portao..."
            />
          </label>
        </section>

        <footer className="cart-footer">
          <div className="total-line">
            <span>Subtotal</span>
            <strong>R$ {totals.subtotal.toFixed(2).replace(".", ",")}</strong>
          </div>
          <div className="total-line">
            <span>Taxa de entrega</span>
            <strong>R$ {totals.deliveryFee.toFixed(2).replace(".", ",")}</strong>
          </div>
          {totals.discount > 0 ? (
            <div className="total-line success">
              <span>Desconto</span>
              <strong>- R$ {totals.discount.toFixed(2).replace(".", ",")}</strong>
            </div>
          ) : null}
          <div className="total-line grand">
            <span>Total</span>
            <strong>R$ {totals.total.toFixed(2).replace(".", ",")}</strong>
          </div>

          <button
            type="button"
            className="button button-primary button-block"
            onClick={onSubmit}
            disabled={!items.length || submitting}
          >
            {submitting ? "Enviando pedido..." : "Finalizar pedido"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

export default CartDrawer;
