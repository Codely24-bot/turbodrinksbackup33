import React from 'react';
import { getOrderStatusTone } from '@/features/delivery/services/deliveryHubService';

const StatusBadge = ({ status }) => {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusTone(
        status,
      )}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
