import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Typography, List, ListItem, ListItemText, 
  Button, Select, MenuItem, Box, Grid,
  FormControl, InputLabel, Chip, Paper, IconButton, Tooltip, Alert, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Sort, Receipt, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { formatEuros } from '../utils/currency';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [notification, setNotification] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [newOrder, setNewOrder] = useState({
    buyer_name: '',
    items_purchased: '',
    total_cost: '',
    shipping_status: 'Pending',
    sales_price: ''
  });
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/orders');
      console.log('Orders data:', response.data);
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusUpdate = (orderId, newStatus) => {
    axios.put(`http://127.0.0.1:5000/orders/${orderId}`, {
      order_id: orderId,
      shipping_status: newStatus
    })
    .then(() => {
      setNotification(`Order #${orderId} status updated successfully!`);
    })
    .catch(error => {
      if (error.response && error.response.status === 403) {
        setNotification('Permission denied: Cannot update order status');
      } else {
        console.error('Error updating status:', error);
        setNotification('Error updating order status');
      }
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'warning';
      case 'Shipped': return 'info';
      case 'Delivered': return 'success';
      default: return 'default';
    }
  };

  const handleSort = () => {
    const sorted = [...orders].sort((a, b) => {
      return sortOrder === 'asc' 
        ? a.order_id - b.order_id 
        : b.order_id - a.order_id;
    });
    setOrders(sorted);
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const handleAdd = async () => {
    try {
      await axios.post('http://127.0.0.1:5000/orders', {
        ...newOrder,
        order_id: String(orders.length + 1),
        order_date: new Date().toISOString().split('T')[0]
      });
      setOpenDialog(false);
      setNewOrder({});
      fetchOrders();
    } catch (error) {
      console.error('Error adding order:', error);
    }
  };

  const handleDelete = async (orderId) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await axios.delete(`http://127.0.0.1:5000/orders/${orderId}`);
        fetchOrders();
      } catch (error) {
        console.error('Error deleting order:', error);
      }
    }
  };

  const handleEdit = (order) => {
    setEditOrder(order);
    setNewOrder(order);
    setOpenDialog(true);
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setDetailsDialog(true);
  };

  const filteredOrders = orders.filter(order =>
    statusFilter ? order.shipping_status === statusFilter : true
  );

  return (
    <Box sx={{ p: 3 }}>
      {notification && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotification('')}>
          {notification}
        </Alert>
      )}
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Orders Management</Typography>
            <Tooltip title="Sort by Order ID">
              <IconButton onClick={handleSort}>
                <Sort />
              </IconButton>
            </Tooltip>
          </Box>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Pending">Pending</MenuItem>
              <MenuItem value="Shipped">Shipped</MenuItem>
              <MenuItem value="Delivered">Delivered</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setOpenDialog(true)}
        sx={{ mb: 2 }}
      >
        Add New Order
      </Button>

      <List>
        {filteredOrders.map(order => (
          <Paper elevation={2} sx={{ mb: 2, p: 2 }} key={order.order_id}>
            <ListItem sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6">
                  Order #{order.order_id}
                  <Chip 
                    label={order.shipping_status}
                    color={getStatusColor(order.shipping_status)}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Typography>
                <ListItemText
                  secondary={
                    <React.Fragment>
                      <Typography component="span" variant="body2">
                        Customer: {order.buyer_name}<br/>
                        Items: {order.items_purchased}<br/>
                        Cost: {formatEuros(order.total_cost)}<br/>
                        Sales Price: {formatEuros(order.sales_price)}<br/>
                        Profit: {formatEuros(order.sales_price - order.total_cost)}
                      </Typography>
                    </React.Fragment>
                  }
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Select
                  value={order.shipping_status}
                  onChange={e => handleStatusUpdate(order.order_id, e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Shipped">Shipped</MenuItem>
                  <MenuItem value="Delivered">Delivered</MenuItem>
                </Select>
                <Tooltip title="Delete Order">
                  <IconButton color="error" onClick={() => handleDelete(order.order_id)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="View Details">
                  <IconButton onClick={() => handleViewDetails(order)}>
                    <Receipt />
                  </IconButton>
                </Tooltip>
              </Box>
            </ListItem>
          </Paper>
        ))}
      </List>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>{editOrder ? 'Edit Order' : 'Add New Order'}</DialogTitle>
        <DialogContent>
          <TextField
            label="Buyer Name"
            value={newOrder.buyer_name || ''}
            onChange={e => setNewOrder({...newOrder, buyer_name: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Items Purchased"
            value={newOrder.items_purchased || ''}
            onChange={e => setNewOrder({...newOrder, items_purchased: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Total Cost"
            type="number"
            value={newOrder.total_cost || ''}
            onChange={e => setNewOrder({...newOrder, total_cost: e.target.value})}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Sales Price"
            type="number"
            value={newOrder.sales_price || ''}
            onChange={e => setNewOrder({...newOrder, sales_price: e.target.value})}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={editOrder ? handleEdit : handleAdd} variant="contained">
            {editOrder ? 'Save Changes' : 'Add Order'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailsDialog} onClose={() => setDetailsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Order Details</DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h6">
                  Order #{selectedOrder.order_id}
                  <Chip 
                    label={selectedOrder.shipping_status}
                    color={getStatusColor(selectedOrder.shipping_status)}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Customer</Typography>
                <Typography>{selectedOrder.buyer_name}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2">Order Date</Typography>
                <Typography>{selectedOrder.order_date}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2">Items Purchased</Typography>
                <Typography>{selectedOrder.items_purchased}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2">Cost</Typography>
                <Typography>{formatEuros(selectedOrder.total_cost)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2">Sales Price</Typography>
                <Typography>{formatEuros(selectedOrder.sales_price)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2">Profit</Typography>
                <Typography color="success.main">
                  {formatEuros(selectedOrder.sales_price - selectedOrder.total_cost)}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Orders;