import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, MapPinned, MessageCircle, Wallet } from "lucide-react";
import { api, socket } from "../api";
import StatusTimeline, { STATUS_STEPS } from "../components/StatusTimeline";

const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;

const paymentLabel = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartao na entrega"
};

function TrackingPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [orderPayload, storePayload] = await Promise.all([api.getOrder(orderId), api.getStore()]);
        setOrder(orderPayload);
        setStore(storePayload);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [orderId]);

  useEffect(() => {
    socket.emit("order:subscribe", orderId);
    const handleUpdate = (payload) => {
      if (payload?.id === orderId) {
        setOrder(payload);
      }
    };

    socket.on("order:updated", handleUpdate);
    return () => {
      socket.off("order:updated", handleUpdate);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="page-shell centered">
        <div className="loading-card">
          <span className="eyebrow">Rastreamento em tempo real</span>
          <h1>Buscando seu pedido</h1>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="page-shell centered">
        <div className="loading-card">
          <span className="eyebrow">Nao localizado</span>
          <h1>{error || "Pedido nao encontrado"}</h1>
          <Link to="/" className="button button-primary">
            Voltar para loja
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = STATUS_STEPS.find((step) => step.key === order.status);
  const whatsAppLink = store?.settings?.whatsappNumber
    ? `https://wa.me/${store.settings.whatsappNumber}?text=${encodeURIComponent(
        `Oi! Quero ajuda com o pedido #${order.number}`
      )}`
    : null;

  return (
    <div className="page-shell tracking">
      <header className="tracking-header">
        <Link to="/" className="button button-outline">
          <ArrowLeft size={16} />
          Voltar para loja
        </Link>
        <span className="status-pill">{currentStatus?.label || "Acompanhando"}</span>
      </header>

      <section className="tracking-grid">
        <article className="tracking-card hero">
          <span className="eyebrow">Pedido #{order.number}</span>
          <h1>{currentStatus?.label}</h1>
          <p>Atualizado em tempo real. Sempre que o status mudar, o cliente recebe uma mensagem automatica.</p>

          <div className="tracking-highlights">
            <div>
              <Clock3 size={18} />
              <span>{new Date(order.updatedAt).toLocaleString("pt-BR")}</span>
            </div>
            <div>
              <MapPinned size={18} />
              <span>{order.customer.neighborhood}</span>
            </div>
            <div>
              <Wallet size={18} />
              <span>{paymentLabel[order.paymentMethod]}</span>
            </div>
          </div>
        </article>

        <article className="tracking-card">
          <h2>Entrega</h2>
          <div className="summary-list">
            <div>
              <span>Cliente</span>
              <strong>{order.customer.name}</strong>
            </div>
            <div>
              <span>Telefone</span>
              <strong>{order.customer.phone}</strong>
            </div>
            <div>
              <span>Endereco</span>
              <strong>{order.customer.address}</strong>
            </div>
            <div>
              <span>Observacao</span>
              <strong>{order.customer.note || "Sem observacoes"}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="tracking-grid secondary">
        <article className="tracking-card">
          <h2>Status do pedido</h2>
          <StatusTimeline status={order.status} timeline={order.statusTimeline} />
        </article>

        <article className="tracking-card">
          <h2>Resumo</h2>
          <div className="summary-items">
            {order.items.map((item) => (
              <div key={`${item.productId}-${item.name}`} className="summary-item">
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.quantity}x {item.volume}
                  </span>
                </div>
                <strong>{formatCurrency(item.lineTotal)}</strong>
              </div>
            ))}
          </div>

          <div className="summary-total">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(order.subtotal)}</strong>
            </div>
            <div>
              <span>Entrega</span>
              <strong>{formatCurrency(order.deliveryFee)}</strong>
            </div>
            {order.discount > 0 ? (
              <div>
                <span>Desconto</span>
                <strong>- {formatCurrency(order.discount)}</strong>
              </div>
            ) : null}
            <div className="grand">
              <span>Total</span>
              <strong>{formatCurrency(order.total)}</strong>
            </div>
          </div>

          {whatsAppLink ? (
            <a href={whatsAppLink} target="_blank" rel="noreferrer" className="button button-primary button-block">
              <MessageCircle size={16} />
              Falar com a distribuidora
            </a>
          ) : null}
        </article>
      </section>
    </div>
  );
}

export default TrackingPage;
