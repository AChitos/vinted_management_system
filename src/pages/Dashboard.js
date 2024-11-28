import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Card, CardContent, Grid,
  Paper, List, ListItem, ListItemText, Chip,
  LinearProgress
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  ShoppingCart as OrdersIcon,
  AttachMoney as ProfitIcon,
  Timeline as TrendIcon
} from '@mui/icons-material';
import axios from 'axios';
import { formatEuros } from '../utils/currency';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

function Dashboard() {
  const [summary, setSummary] = useState({
    inventoryCount: 0,
    totalSales: 0,
    totalProfit: 0,
    recentOrders: [],
    lowStockItems: [],
    monthlyData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const [inventoryRes, ordersRes, financialRes] = await Promise.all([
          axios.get('http://127.0.0.1:5000/inventory'),
          axios.get('http://127.0.0.1:5000/orders'),
          axios.get('http://127.0.0.1:5000/financial')
        ]);

        // Calculate totals from financial records
        const financialTotals = financialRes.data.reduce((acc, record) => ({
          sales: acc.sales + (parseFloat(record.total_sales) || 0),
          profit: acc.profit + (parseFloat(record.profit) || 0)
        }), { sales: 0, profit: 0 });

        // Process monthly data for the chart
        const monthlyData = processMonthlyData(financialRes.data);

        setSummary({
          inventoryCount: inventoryRes.data.length,
          totalSales: financialTotals.sales,
          totalProfit: financialTotals.profit,
          recentOrders: ordersRes.data.slice(-5).reverse(),
          lowStockItems: inventoryRes.data.filter(item => parseInt(item.quantity) < 5),
          monthlyData
        });
        setLoading(false);
      } catch (error) {
        console.error('Error fetching summary:', error);
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const processMonthlyData = (financialData) => {
    const monthlyMap = financialData.reduce((acc, record) => {
      const date = record.transaction_date.substring(0, 7); // Get YYYY-MM
      if (!acc[date]) {
        acc[date] = {
          date,
          sales: 0,
          profit: 0
        };
      }
      acc[date].sales += parseFloat(record.total_sales || 0);
      acc[date].profit += parseFloat(record.profit || 0);
      return acc;
    }, {});

    return Object.values(monthlyMap).sort((a, b) => a.date.localeCompare(b.date));
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Dashboard Overview
      </Typography>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: 'primary.light' }}>
            <CardContent sx={{ color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <InventoryIcon sx={{ mr: 2 }} />
                <div>
                  <Typography variant="h6">Inventory Items</Typography>
                  <Typography variant="h4">{summary.inventoryCount}</Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: 'success.light' }}>
            <CardContent sx={{ color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <OrdersIcon sx={{ mr: 2 }} />
                <div>
                  <Typography variant="h6">Total Sales</Typography>
                  <Typography variant="h4">{formatEuros(summary.totalSales)}</Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: 'warning.light' }}>
            <CardContent sx={{ color: 'white' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ProfitIcon sx={{ mr: 2 }} />
                <div>
                  <Typography variant="h6">Total Profit</Typography>
                  <Typography variant="h4">{formatEuros(summary.totalProfit)}</Typography>
                </div>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sales Chart */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <TrendIcon sx={{ mr: 1 }} /> Monthly Performance
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={summary.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="sales" stroke="#2196f3" name="Sales" />
                  <Line type="monotone" dataKey="profit" stroke="#4caf50" name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Recent Orders */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Recent Orders</Typography>
            <List>
              {summary.recentOrders.map((order) => (
                <ListItem key={order.order_id}>
                  <ListItemText
                    primary={`Order #${order.order_id}`}
                    secondary={
                      <>
                        {order.buyer_name} - {formatEuros(order.total_cost)}
                        <Chip
                          size="small"
                          label={order.shipping_status}
                          color={
                            order.shipping_status === 'Delivered' ? 'success' :
                            order.shipping_status === 'Shipped' ? 'primary' : 'warning'
                          }
                          sx={{ ml: 1 }}
                        />
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Low Stock Alert */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Low Stock Alert</Typography>
            <List>
              {summary.lowStockItems.map((item) => (
                <ListItem key={item.item_name}>
                  <ListItemText
                    primary={item.item_name}
                    secondary={
                      <Box component="span">
                        Category: {item.category}
                        <Chip
                          size="small"
                          label={`${item.quantity} left`}
                          color="error"
                          sx={{ ml: 1 }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;