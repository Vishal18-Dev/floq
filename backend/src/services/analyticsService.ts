import { query, queryOne } from '../db';
import { DailySalesSummary, HourlyMetric, TopProductMetric } from '@floq/types';

export class AnalyticsService {
  public async getDailySummary(storeId: string, dateStr?: string): Promise<DailySalesSummary> {
    const date = dateStr || new Date().toISOString().split('T')[0];

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    // 1. Basic counts & totals for non-cancelled orders today
    const summaryRow = await queryOne(
      `SELECT
         COUNT(*) as total_orders,
         COALESCE(SUM(total), 0) as total_revenue
       FROM orders
       WHERE store_id = $1
         AND created_at >= $2
         AND created_at <= $3
         AND status != 'CANCELLED'`,
      [storeId, startOfDay, endOfDay]
    );

    const totalOrders = Number(summaryRow?.total_orders || 0);
    const totalRevenue = Number(summaryRow?.total_revenue || 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 2. Payment breakdowns
    const paymentRows = await query(
      `SELECT
         p.method,
         COALESCE(SUM(p.amount), 0) as method_total
       FROM payments p
       JOIN orders o ON p.order_id = o.id
       WHERE o.store_id = $1
         AND p.created_at >= $2
         AND p.created_at <= $3
         AND p.status = 'SUCCESS'
         AND o.status != 'CANCELLED'
       GROUP BY p.method`,
      [storeId, startOfDay, endOfDay]
    );

    let upiRevenue = 0;
    let cashRevenue = 0;
    let otherRevenue = 0;

    for (const r of paymentRows) {
      const amt = Number(r.method_total);
      if (r.method === 'UPI') upiRevenue = amt;
      else if (r.method === 'CASH') cashRevenue = amt;
      else otherRevenue += amt;
    }

    // 3. Top Products
    const topProductsRows = await query(
      `SELECT
         oi.product_id,
         oi.product_name_snapshot as name,
         SUM(oi.quantity) as quantity,
         SUM(oi.subtotal) as revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.store_id = $1
         AND o.created_at >= $2
         AND o.created_at <= $3
         AND o.status != 'CANCELLED'
       GROUP BY oi.product_id, oi.product_name_snapshot
       ORDER BY quantity DESC
       LIMIT 5`,
      [storeId, startOfDay, endOfDay]
    );

    const topProducts: TopProductMetric[] = topProductsRows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
    }));

    // 4. Hourly Distribution & Peak Hour
    const orderTimes = await query(
      `SELECT created_at, total FROM orders
       WHERE store_id = $1
         AND created_at >= $2
         AND created_at <= $3
         AND status != 'CANCELLED'`,
      [storeId, startOfDay, endOfDay]
    );

    const hourlyMap: Record<number, { count: number; revenue: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { count: 0, revenue: 0 };
    }

    for (const ot of orderTimes) {
      const h = new Date(ot.created_at).getHours();
      if (hourlyMap[h]) {
        hourlyMap[h].count += 1;
        hourlyMap[h].revenue += Number(ot.total);
      }
    }

    let peakHour: number | null = null;
    let maxOrdersInHour = 0;
    const hourlyDistribution: HourlyMetric[] = [];

    for (let h = 0; h < 24; h++) {
      hourlyDistribution.push({
        hour: h,
        orderCount: hourlyMap[h].count,
        revenue: hourlyMap[h].revenue,
      });
      if (hourlyMap[h].count > maxOrdersInHour) {
        maxOrdersInHour = hourlyMap[h].count;
        peakHour = h;
      }
    }

    // 5. Average Preparation Time
    const prepTimes = await query(
      `SELECT created_at, ready_at FROM orders
       WHERE store_id = $1
         AND created_at >= $2
         AND created_at <= $3
         AND ready_at IS NOT NULL
         AND status != 'CANCELLED'`,
      [storeId, startOfDay, endOfDay]
    );

    let totalPrepMinutes = 0;
    for (const pt of prepTimes) {
      const start = new Date(pt.created_at).getTime();
      const ready = new Date(pt.ready_at).getTime();
      totalPrepMinutes += Math.max(0, Math.round((ready - start) / (1000 * 60)));
    }
    const averagePreparationMinutes = prepTimes.length > 0 ? Math.round(totalPrepMinutes / prepTimes.length) : 4;

    // 6. Delayed orders count
    const storeSettings = await queryOne('SELECT typical_prep_time_minutes FROM store_settings WHERE store_id = $1', [storeId]);
    const typicalPrepMinutes = storeSettings?.typical_prep_time_minutes || 6;

    let delayedOrdersCount = 0;
    const allActiveOrders = await query(
      `SELECT created_at, preparing_at FROM orders
       WHERE store_id = $1
         AND created_at >= $2
         AND created_at <= $3
         AND status IN ('NEW', 'ACCEPTED', 'PREPARING')`,
      [storeId, startOfDay, endOfDay]
    );

    for (const ao of allActiveOrders) {
      const start = new Date(ao.preparing_at || ao.created_at).getTime();
      const elapsed = Math.floor((Date.now() - start) / (1000 * 60));
      if (elapsed >= typicalPrepMinutes) {
        delayedOrdersCount++;
      }
    }

    return {
      date,
      revenue: totalRevenue,
      orders: totalOrders,
      averageOrderValue,
      upiRevenue,
      cashRevenue,
      otherRevenue,
      topProducts,
      peakHour,
      hourlyDistribution,
      averagePreparationMinutes,
      delayedOrdersCount,
    };
  }
}

export const analyticsService = new AnalyticsService();
