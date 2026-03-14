export const STATUS_STEPS = [
  {
    key: "received",
    label: "Pedido recebido",
    description: "Pedido entrou na base e sera confirmado."
  },
  {
    key: "accepted",
    label: "Pedido aceito",
    description: "Time validou itens, pagamento e fila."
  },
  {
    key: "preparing",
    label: "Em preparacao",
    description: "Separacao e conferencias em andamento."
  },
  {
    key: "out_for_delivery",
    label: "Saiu para entrega",
    description: "Motoboy a caminho do endereco informado."
  },
  {
    key: "delivered",
    label: "Entregue",
    description: "Pedido finalizado com sucesso."
  }
];

function StatusTimeline({ status, timeline = [] }) {
  const currentIndex = STATUS_STEPS.findIndex((step) => step.key === status);

  return (
    <ol className="status-timeline">
      {STATUS_STEPS.map((step, index) => {
        const event = timeline.find((entry) => entry.status === step.key);
        const completed = index <= currentIndex;
        const current = step.key === status;

        return (
          <li
            key={step.key}
            className={`status-step ${completed ? "completed" : ""} ${current ? "current" : ""}`}
          >
            <span className="status-dot" />
            <div>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
              <small>
                {event
                  ? new Date(event.timestamp).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "Aguardando"}
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default StatusTimeline;
