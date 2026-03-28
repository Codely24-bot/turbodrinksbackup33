import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['var(--layout-accent)', '#0088FE', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

const ChartContainer = ({ title, children }) => (
  <div className="bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)] shadow-lg h-[350px] flex flex-col">
    <h3 className="text-white font-bold mb-4">{title}</h3>
    <div className="flex-1 w-full min-h-0">
      {children}
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--layout-bg)] border border-[var(--layout-border)] p-3 rounded shadow-xl">
        <p className="text-white font-bold mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {typeof entry.value === 'number' ? `R$ ${entry.value.toFixed(2)}` : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const RelatorioGraficos = ({ vendasPorDia, formasPagamento, lucroVsCusto }) => {
  return (
    <div className="space-y-6 h-full">
      <ChartContainer title="Vendas por Dia (30 dias)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={vendasPorDia}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--layout-border)" />
            <XAxis dataKey="name" stroke="var(--layout-text-muted)" fontSize={12} tickLine={false} />
            <YAxis stroke="var(--layout-text-muted)" fontSize={12} tickLine={false} tickFormatter={(value) => `R$${value}`} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="value" 
              name="Vendas" 
              stroke="var(--layout-accent)" 
              strokeWidth={3} 
              dot={{ fill: 'var(--layout-accent)', r: 4 }} 
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartContainer title="Formas de Pagamento">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formasPagamento}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {formasPagamento.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Lucro vs Custo">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lucroVsCusto} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--layout-border)" horizontal={false} />
              <XAxis type="number" stroke="var(--layout-text-muted)" fontSize={12} tickFormatter={(value) => `R$${value}`} />
              <YAxis dataKey="name" type="category" stroke="var(--layout-text-muted)" fontSize={12} width={60} />
              <Tooltip cursor={{fill: 'var(--layout-border)', opacity: 0.2}} content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {lucroVsCusto.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name === 'Lucro' ? 'var(--layout-accent)' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
};

export default RelatorioGraficos;
