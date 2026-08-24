import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Order } from "../types";
import { StatusBadge } from "../components/StatusBadge";

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    api.get("/orders").then((res) => setOrders(res.data.orders));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My orders</h1>
          <p>Track every delivery you've booked, live.</p>
        </div>
        <Link to="/orders/new" className="btn">
          + New order
        </Link>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {orders === null && <div className="empty-state">Loading...</div>}
        {orders && orders.length === 0 && (
          <div className="empty-state">
            No orders yet. <Link to="/orders/new">Create your first order</Link>.
          </div>
        )}
        {orders && orders.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Route</th>
                <th>Type</th>
                <th>Charge</th>
                <th>Status</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const navigate = useNavigate();
  return (
    <tr className="clickable" onClick={() => navigate(`/orders/${order.id}`)}>
      <td>#{order.id.slice(0, 8)}</td>
      <td>
        {order.pickupZone?.name} → {order.dropZone?.name}
      </td>
      <td>
        {order.orderType} · {order.paymentType}
      </td>
      <td>₹{order.totalCharge}</td>
      <td>
        <StatusBadge status={order.status} />
      </td>
      <td className="muted">{new Date(order.createdAt).toLocaleDateString()}</td>
    </tr>
  );
}
